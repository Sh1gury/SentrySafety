import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { runLayer1 } from "@/lib/sanitizer";
import { runLayer2, runLayer3 } from "@/lib/ai";
import { fuseAllLayers } from "@/lib/ai/fusion";
import type {
  SanitizeRequest,
  SanitizeResponse,
  SanitizeSuccess,
  SanitizeError,
} from "@/types/scan";

const MAX_BATCH_ITEMS = 25;
const MAX_CONCURRENCY = 5;

interface BatchRequest {
  items: SanitizeRequest[];
}

interface BatchSuccess {
  status: "success";
  results: SanitizeResponse[];
}

interface BatchError {
  status: "error";
  error: SanitizeError["error"];
  message: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<BatchSuccess | BatchError>> {
  let body: BatchRequest;
  try {
    body = (await request.json()) as BatchRequest;
  } catch {
    return NextResponse.json(
      { status: "error", error: "invalid_payload", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json(
      { status: "error", error: "invalid_payload", message: "Body must include an 'items' array." },
      { status: 400 },
    );
  }

  if (body.items.length === 0) {
    return NextResponse.json(
      { status: "error", error: "invalid_payload", message: "'items' must contain at least one entry." },
      { status: 400 },
    );
  }

  if (body.items.length > MAX_BATCH_ITEMS) {
    return NextResponse.json(
      {
        status: "error",
        error: "invalid_payload",
        message: `Batch size exceeds limit of ${MAX_BATCH_ITEMS}.`,
      },
      { status: 400 },
    );
  }

  const results: SanitizeResponse[] = new Array(body.items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= body.items.length) return;
      results[idx] = await processOne(body.items[idx]);
    }
  }

  const workers: Promise<void>[] = [];
  const poolSize = Math.min(MAX_CONCURRENCY, body.items.length);
  for (let i = 0; i < poolSize; i++) workers.push(worker());
  await Promise.all(workers);

  return NextResponse.json({ status: "success", results });
}

async function processOne(item: SanitizeRequest): Promise<SanitizeResponse> {
  const startMs = Date.now();
  const scanId = `scn_${nanoid(16)}`;

  try {
    // ── Validate ────────────────────────────────────────────────────────────

    if (!item.content && !item.file_base64) {
      return {
        status: "error",
        error: "invalid_payload",
        message: "Either 'content' or 'file_base64' is required.",
      } satisfies SanitizeError;
    }
    if (item.content && item.file_base64) {
      return {
        status: "error",
        error: "invalid_payload",
        message: "'content' and 'file_base64' are mutually exclusive.",
      } satisfies SanitizeError;
    }

    // ── Layer 1 ─────────────────────────────────────────────────────────────

    const layer1 = await runLayer1(item);

    if (layer1.hard_block) {
      return {
        status: "error",
        error: layer1.hard_block.error,
        message: layer1.hard_block.message,
      } satisfies SanitizeError;
    }

    // ── Layer 2 ─────────────────────────────────────────────────────────────

    const demoMode = process.env.DEMO_MODE === "true";
    let layer2;

    try {
      layer2 = await runLayer2(layer1.clean_text, { demoMode });
    } catch {
      if (!demoMode) {
        return {
          status: "error",
          error: "model_unavailable",
          message: "Layer 2 LLM unavailable. Set DEMO_MODE=true as fallback.",
        } satisfies SanitizeError;
      }
      return {
        status: "error",
        error: "engine_error",
        message: "Layer 2 failed even in demo mode.",
      } satisfies SanitizeError;
    }

    // ── Layer 3 (opt-in) ────────────────────────────────────────────────────

    const layer3 = await runLayer3(layer1.clean_text, {
      enabled: item.config?.integrity?.check_autophagy ?? false,
    });

    // ── Fuse verdicts ────────────────────────────────────────────────────────

    const finalVerdict = fuseAllLayers(layer1.report.verdict, layer2.verdict);

    // ── Build response (no tokenMap in batch) ───────────────────────────────

    const payload: SanitizeSuccess = {
      status: "success",
      scanId,
      verdict: finalVerdict,
      clean_text: layer1.clean_text,
      metadata: {
        pii_masked_count: layer1.pii_masked_count,
        threats_blocked: layer1.threats_blocked,
        synthetic_spam_removed: (layer3.synthetic_paragraphs_removed ?? 0) > 0,
        layer1: layer1.report,
        layer2,
        layer3,
      },
      latencyMs: Date.now() - startMs,
    };

    return payload;
  } catch (err) {
    console.error(`[sanitize:batch] ${scanId} unhandled error:`, err);
    return {
      status: "error",
      error: "engine_error",
      message: "Internal engine error.",
    } satisfies SanitizeError;
  }
}
