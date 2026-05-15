import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { runLayer1 } from "@/lib/sanitizer";
import { runLayer2, runLayer3 } from "@/lib/ai";
import { fuseAllLayers } from "@/lib/ai/fusion";
import { logger } from "@/lib/logger";
import { cacheGet, cacheSet } from "@/lib/cache";
import { checkRate } from "@/lib/rateLimit";
import { withCircuit } from "@/lib/circuitBreaker";
import { recordAudit } from "@/lib/auditLog";
import { inc, observe } from "@/lib/metrics";
import type {
  SanitizeRequest,
  SanitizeResponse,
  SanitizeSuccess,
  SanitizeError,
  Layer2Report,
} from "@/types/scan";

const CORS_DEV_ORIGIN = "http://localhost:4000";
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB pre-extraction guard
const IDEMPOTENCY_TTL_MS = 5 * 60_000;
const LAYER2_CACHE_TTL_MS = 5 * 60_000;
const CIRCUIT_NAME = "groq-layer2";

function corsHeaders(origin: string | null): HeadersInit {
  if (process.env.NODE_ENV !== "development") return {};
  if (origin !== CORS_DEV_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": CORS_DEV_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, Idempotency-Key",
  };
}

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function apiKeyOk(key: string | null): boolean {
  const raw = (process.env.SENTRY_SAFETY_API_KEYS ?? "").trim();
  if (raw.length === 0) return true; // no allowlist → MVP mode, accept anything
  if (!key) return false;
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(key.trim());
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<SanitizeResponse>> {
  const startMs = Date.now();
  const scanId = `scn_${nanoid(16)}`;
  const origin = request.headers.get("origin");
  const apiKey = request.headers.get("x-api-key");
  const isAuthenticated = !!(apiKey && apiKey.trim().length > 0);
  const idempotencyKey = request.headers.get("idempotency-key");

  let l1ms = 0;
  let l2ms = 0;
  let l3ms = 0;
  let inputLength = 0;

  const fail = (
    status: number,
    error: SanitizeError["error"],
    message: string,
  ): NextResponse<SanitizeError> => {
    inc("sentry_errors_total", { code: error });
    recordAudit({
      ts: new Date().toISOString(),
      scanId,
      verdict: "error",
      errorCode: error,
      inputLength,
      latencyMs: Date.now() - startMs,
    });
    logger.warn({ scanId, error, message, status }, "sanitize: error response");
    return NextResponse.json(
      { status: "error", error, message } satisfies SanitizeError,
      { status, headers: { ...corsHeaders(origin), "x-scan-id": scanId } },
    );
  };

  try {
    // ── Pre-flight: body size, rate limit, API key, idempotency ──────────────

    const declaredLen = Number(request.headers.get("content-length") ?? "0");
    if (declaredLen > MAX_BODY_BYTES) {
      return fail(413, "payload_too_large", "Request body exceeds 5 MB.");
    }

    const rate = checkRate(`sanitize:${clientKey(request)}`);
    if (!rate.allowed) {
      inc("sentry_rate_limited_total");
      return fail(429, "rate_limited", "Rate limit exceeded; retry later.");
    }

    if (!apiKeyOk(apiKey)) {
      return fail(400, "invalid_payload", "Invalid or missing API key.");
    }

    if (idempotencyKey) {
      const cached = cacheGet<SanitizeSuccess>(`idem:${idempotencyKey}`);
      if (cached) {
        inc("sentry_idempotency_hits_total");
        return NextResponse.json(cached, {
          headers: {
            ...corsHeaders(origin),
            "x-scan-id": cached.scanId,
            "x-idempotent-replay": "true",
          },
        });
      }
    }

    // ── Parse body ──────────────────────────────────────────────────────────

    let body: SanitizeRequest;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      const configRaw = form.get("config");

      if (!file) {
        return fail(400, "invalid_payload", "Multipart request must include a 'file' field.");
      }

      const arrayBuf = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString("base64");
      body = {
        filename: file.name,
        file_base64: base64,
        config: configRaw ? JSON.parse(configRaw as string) : undefined,
      };
    } else {
      body = (await request.json()) as SanitizeRequest;
    }

    inputLength =
      body.content?.length ??
      (body.file_base64 ? Math.floor((body.file_base64.length * 3) / 4) : 0);

    // ── Validate ────────────────────────────────────────────────────────────

    if (!body.content && !body.file_base64) {
      return fail(400, "invalid_payload", "Either 'content' or 'file_base64' is required.");
    }
    if (body.content && body.file_base64) {
      return fail(400, "invalid_payload", "'content' and 'file_base64' are mutually exclusive.");
    }

    // ── Layer 1 ─────────────────────────────────────────────────────────────

    const t1 = Date.now();
    const layer1 = await runLayer1(body);
    l1ms = Date.now() - t1;

    if (layer1.hard_block) {
      const status =
        layer1.hard_block.error === "payload_too_large" ? 413
        : layer1.hard_block.error === "unsupported_media_type" ? 415
        : layer1.hard_block.error === "encrypted_archive" ? 400
        : 400;
      return fail(status, layer1.hard_block.error, layer1.hard_block.message);
    }

    // ── Layer 2 (with cache + circuit breaker) ──────────────────────────────

    const demoMode = process.env.DEMO_MODE === "true";
    const t2 = Date.now();
    let layer2: Layer2Report;

    const l2CacheKey = `l2:${demoMode ? "demo" : "live"}:${sha256(layer1.clean_text)}`;
    const l2Cached = cacheGet<Layer2Report>(l2CacheKey);

    if (l2Cached) {
      inc("sentry_layer2_cache_hits_total");
      layer2 = l2Cached;
    } else {
      try {
        layer2 = await withCircuit({ name: CIRCUIT_NAME }, () =>
          runLayer2(layer1.clean_text, { demoMode }),
        );
        cacheSet(l2CacheKey, layer2, LAYER2_CACHE_TTL_MS);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isCircuitOpen = msg.startsWith("circuit_open");
        inc("sentry_layer2_failures_total", { reason: isCircuitOpen ? "circuit_open" : "error" });
        logger.error({ scanId, err: msg }, "layer2 failed");
        if (!demoMode) {
          return fail(
            502,
            "model_unavailable",
            isCircuitOpen
              ? "Layer 2 circuit is open after repeated failures; retry later or set DEMO_MODE=true."
              : "Layer 2 LLM unavailable. Set DEMO_MODE=true as fallback.",
          );
        }
        throw new Error("Layer 2 failed even in demo mode");
      }
    }
    l2ms = Date.now() - t2;

    // ── Layer 3 (opt-in) ────────────────────────────────────────────────────

    const t3 = Date.now();
    const layer3 = await runLayer3(layer1.clean_text, {
      enabled: body.config?.integrity?.check_autophagy ?? false,
    });
    l3ms = Date.now() - t3;

    // ── Fuse ────────────────────────────────────────────────────────────────

    const finalVerdict = fuseAllLayers(layer1.report.verdict, layer2.verdict);
    const latencyMs = Date.now() - startMs;

    const payload: SanitizeSuccess = {
      status: "success",
      scanId,
      verdict: finalVerdict,
      clean_text: layer1.clean_text,
      ...(isAuthenticated ? { tokenMap: layer1.tokenMap } : {}),
      metadata: {
        pii_masked_count: layer1.pii_masked_count,
        threats_blocked: layer1.threats_blocked,
        synthetic_spam_removed: (layer3.synthetic_paragraphs_removed ?? 0) > 0,
        layer1: layer1.report,
        layer2,
        layer3,
      },
      latencyMs,
    };

    // ── Audit + metrics + idempotency cache ─────────────────────────────────

    recordAudit({
      ts: new Date().toISOString(),
      scanId,
      verdict: finalVerdict,
      layer1Verdict: layer1.report.verdict,
      layer2Verdict: layer2.verdict,
      layer3Enabled: layer3.enabled,
      latencyMs,
      inputLength,
      threatsBlocked: { ...layer1.threats_blocked },
    });

    inc("sentry_scans_total", { verdict: finalVerdict });
    observe("sentry_scan_latency_ms", latencyMs);
    observe("sentry_layer1_latency_ms", l1ms);
    observe("sentry_layer2_latency_ms", l2ms);
    if (layer3.enabled) observe("sentry_layer3_latency_ms", l3ms);

    if (idempotencyKey) {
      cacheSet(`idem:${idempotencyKey}`, payload, IDEMPOTENCY_TTL_MS);
    }

    logger.info(
      {
        scanId,
        verdict: finalVerdict,
        l1ms,
        l2ms,
        l3ms,
        latencyMs,
        pii_masked: layer1.pii_masked_count,
        threats: layer1.threats_blocked,
        demoMode: layer2.demoMode,
      },
      "sanitize: scan complete",
    );

    return NextResponse.json(payload, {
      headers: {
        ...corsHeaders(origin),
        "x-scan-id": scanId,
        "x-latency-l1-ms": String(l1ms),
        "x-latency-l2-ms": String(l2ms),
        "x-latency-l3-ms": String(l3ms),
        "x-rate-remaining": String(rate.remaining),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ scanId, err: msg }, "sanitize: unhandled error");
    return fail(500, "engine_error", "Internal engine error.");
  }
}
