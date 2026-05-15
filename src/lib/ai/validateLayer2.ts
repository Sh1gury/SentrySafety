import type { Verdict } from "@/types/scan";

export interface AgentRawResponse {
  verdict: Verdict;
  score: number;
  reason?: string;
}

export class CanaryMismatchError extends Error {
  constructor() {
    super("Canary mismatch — model response did not authenticate the system prompt");
    this.name = "CanaryMismatchError";
  }
}

export function validateAgentResponse(
  raw: unknown,
  expectedCanary: string,
): AgentRawResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Response is not an object");
  }
  const obj = raw as Record<string, unknown>;

  // Canary check FIRST — if the model didn't echo our canary, it likely
  // followed instructions inside the document instead of our system prompt.
  if (typeof obj.canary !== "string" || obj.canary !== expectedCanary) {
    throw new CanaryMismatchError();
  }

  if (!["allow", "warn", "block"].includes(obj.verdict as string)) {
    throw new Error(`Invalid verdict: ${obj.verdict}`);
  }
  if (typeof obj.score !== "number" || obj.score < 0 || obj.score > 1) {
    throw new Error(`Invalid score: ${obj.score}`);
  }

  return {
    verdict: obj.verdict as Verdict,
    score: obj.score,
    reason: typeof obj.reason === "string" ? obj.reason : undefined,
  };
}

export function scoreToVerdict(score: number): Verdict {
  if (score >= 0.7) return "block";
  if (score >= 0.4) return "warn";
  return "allow";
}
