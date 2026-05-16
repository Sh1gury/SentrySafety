import type { Layer2Report, Verdict } from "@/types/scan";

function scoreToVerdict(score: number): Verdict {
  if (score >= 0.7) return "block";
  if (score >= 0.4) return "warn";
  return "allow";
}

const MARKERS = [
  /ignore\s+(all\s+)?previous/i,
  /you\s+are\s+now/i,
  /developer\s+mode/i,
  /act\s+as\b/i,
  /\bpretend\b/i,
  /\bjailbreak\b/i,
  /new\s+instructions?/i,
  /\bbypass\b/i,
  /forget\s+(your|all|everything)/i,
  /\bdisregard\b/i,
  /from\s+now\s+on/i,
  /your\s+(true|real|hidden|actual)\s+(self|purpose)/i,
  /\bDAN\b/i,
];

function jitter(base: number, spread = 0.05): number {
  return Math.min(1, Math.max(0, base + (Math.random() - 0.5) * spread * 2));
}

export async function mockLayer2(cleanText: string): Promise<Layer2Report> {
  // Simulate realistic LLM latency
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 300));

  const hasMarker = MARKERS.some((re) => re.test(cleanText));

  const semanticScore = hasMarker ? jitter(0.91, 0.06) : jitter(0.04, 0.04);
  const logicScore = hasMarker ? jitter(0.07, 0.05) : jitter(0.03, 0.03);

  const semanticVerdict: Verdict = scoreToVerdict(semanticScore);
  const logicVerdict: Verdict = scoreToVerdict(logicScore);

  const overallVerdict: Verdict =
    semanticVerdict === "block" || logicVerdict === "block"
      ? "block"
      : semanticVerdict === "warn" || logicVerdict === "warn"
      ? "warn"
      : "allow";

  return {
    verdict: overallVerdict,
    score: Math.max(semanticScore, logicScore),
    demoMode: true,
    agents: {
      semantic: { verdict: semanticVerdict, score: semanticScore },
      logic: { verdict: logicVerdict, score: logicScore },
    },
  };
}
