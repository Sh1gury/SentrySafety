import type { AgentVerdict, Layer2Report, Verdict } from "@/types/scan";

function worst(...verdicts: Verdict[]): Verdict {
  if (verdicts.includes("block")) return "block";
  if (verdicts.includes("warn")) return "warn";
  return "allow";
}

export function fuseAgents(
  semantic: AgentVerdict,
  logic: AgentVerdict,
  demoMode: boolean
): Layer2Report {
  return {
    verdict: worst(semantic.verdict, logic.verdict),
    score: Math.max(semantic.score, logic.score),
    demoMode,
    agents: { semantic, logic },
  };
}

export function fuseAllLayers(layer1Verdict: Verdict, layer2Verdict: Verdict): Verdict {
  return worst(layer1Verdict, layer2Verdict);
}
