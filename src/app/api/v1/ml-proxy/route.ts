import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { scanTextDenis } from "@/lib/ai/denisClient";

const HF_FALLBACK_URL =
  "https://api-inference.huggingface.co/models/protectai/deberta-v3-base-prompt-injection-v2";

const MAX_INPUT_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 10_000;

type HFEntry = { label: string; score: number };
type HFResponse = HFEntry[] | HFEntry[][];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // ── Denis Gradio Space (primary) ──────────────────────────────────────────
    const spaceUrl = process.env.DENIS_SPACE_URL;
    if (spaceUrl || process.env.DENIS_API_KEY) {
      try {
        const result = await scanTextDenis(text);
        return NextResponse.json({
          ...result,
          source: "denis:zonda001/poison-defense",
        });
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "ml-proxy: Denis Gradio unavailable, falling back to HF",
        );
      }
    }

    // ── HuggingFace Inference API (fallback) ──────────────────────────────────
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      logger.warn({}, "ml-proxy: no Denis Space configured and HF_TOKEN missing");
      return NextResponse.json(
        { error: "No ML provider configured" },
        { status: 503 },
      );
    }

    const hfRes = await fetch(HF_FALLBACK_URL, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text.slice(0, MAX_INPUT_CHARS) }),
    });

    if (!hfRes.ok) {
      const errBody = await hfRes.text();
      logger.warn(
        { status: hfRes.status, errBody: errBody.slice(0, 200) },
        "ml-proxy: HF inference failed",
      );
      return NextResponse.json(
        { error: "ML inference unavailable", status: hfRes.status },
        { status: 502 },
      );
    }

    const hfData = (await hfRes.json()) as HFResponse;
    const scores: HFEntry[] = Array.isArray(hfData[0])
      ? (hfData[0] as HFEntry[])
      : (hfData as HFEntry[]);

    const injection = scores.find((s) => s.label === "INJECTION");
    const safeEntry = scores.find((s) => s.label === "SAFE");

    const poisonProb =
      injection?.score ?? (safeEntry ? 1 - safeEntry.score : 0);
    const trustWeight = 1 - poisonProb;
    const safe = poisonProb < 0.5;

    return NextResponse.json({
      safe,
      poison_probability: parseFloat(poisonProb.toFixed(4)),
      trust_weight: parseFloat(trustWeight.toFixed(4)),
      predicted_attack_type: safe ? "clean" : "prompt_injection",
      attack_distribution: {
        clean: parseFloat((1 - poisonProb).toFixed(4)),
        prompt_injection: parseFloat(poisonProb.toFixed(4)),
      },
      source: "huggingface:protectai/deberta-v3-base-prompt-injection-v2",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "ml-proxy: internal error");
    return NextResponse.json(
      { error: "ML proxy internal error" },
      { status: 500 },
    );
  }
}
