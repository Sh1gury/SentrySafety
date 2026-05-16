import type { Layer2Report } from "@/types/scan";
import { scanTextDenis } from "./denisClient";
import { mockLayer2 } from "./demoMode";
import { logger } from "@/lib/logger";
import { inc } from "@/lib/metrics";

/**
 * Layer 2 verdict pipeline.
 *
 * Order of preference:
 *   1. DEMO_MODE=true              → deterministic mock (no network).
 *   2. Denis ML Gradio Space       → primary signal.
 *   3. Denis throws / times out    → fall back to mockLayer2 so an
 *                                    attacker who DoS-es the Space can
 *                                    NOT silently bypass Layer 2.
 *
 * `cleanText` is the PII-masked output of Layer 1 (used by the mock).
 * `rawText`   is the unmasked original (sent to Denis — PII tokens
 *             confuse the transformer and inflate scores).
 */
export async function runLayer2Pipeline(
  cleanText: string,
  rawText: string,
): Promise<Layer2Report> {
  const demoMode = process.env.DEMO_MODE === "true";

  if (demoMode) {
    return mockLayer2(cleanText);
  }

  try {
    const mlResult = await scanTextDenis(rawText);
    const score = parseFloat(
      (mlResult.poison_probability ?? (1 - (mlResult.trust_weight ?? 0.5))).toFixed(3),
    );
    // Denis's transformer scores most text at ~0.90–0.95 regardless of
    // content, so raw score alone is unreliable.  Use the binary
    // predicted_attack_type ("clean" vs "prompt_injection") as the
    // primary signal, and only escalate on extreme scores:
    //   type === "clean"             → always allow
    //   type === "prompt_injection"  → allow if score < 0.96
    //                                  warn  if 0.96 ≤ score < 0.99
    //                                  block if score ≥ 0.99
    const isInjection = mlResult.predicted_attack_type === "prompt_injection";
    const mlVerdict = !isInjection
      ? ("allow" as const)
      : score >= 0.99
      ? ("block" as const)
      : score >= 0.96
      ? ("warn" as const)
      : ("allow" as const);

    return {
      verdict: mlVerdict,
      score,
      demoMode: false,
      agents: {
        // Denis's text model is a transformer-based semantic classifier
        semantic: { verdict: mlVerdict, score },
        logic: { verdict: "allow", score: 0 },
      },
    };
  } catch (err) {
    inc("sentry_layer2_failures_total", { reason: "denis_unavailable" });
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Denis ML unavailable; falling back to mockLayer2",
    );
    return mockLayer2(cleanText);
  }
}
