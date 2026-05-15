import type { AgentVerdict, Layer2Report, Layer3Report, Verdict } from "@/types/scan";
import { mockLayer2 } from "./demoMode";
import { runSemanticAgent } from "./agents/semantic";
import { runLogicAgent } from "./agents/logic";
import { fuseAgents } from "./fusion";
import { chunkText } from "./chunking";
import { runLayer3 as _runLayer3 } from "./integrity/runLayer3";

type AgentFn = (
  cleanText: string,
  opts: { temperature: number },
) => Promise<AgentVerdict>;

export async function runLayer2(
  cleanText: string,
  opts: { demoMode: boolean },
): Promise<Layer2Report> {
  if (opts.demoMode) {
    return mockLayer2(cleanText);
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set and DEMO_MODE is false");
  }

  const samples = readSamples();

  // Scan the full document via overlapping chunks. A single Layer 2 call
  // sees at most ~5.5K chars; an attacker placing an injection past that
  // boundary would otherwise slip through.
  const chunks = chunkText(cleanText);

  const perChunk = await Promise.all(
    chunks.map(async (chunk) => {
      const [semantic, logic] = await Promise.all([
        runWithSelfConsistency(runSemanticAgent, chunk, samples),
        runWithSelfConsistency(runLogicAgent, chunk, samples),
      ]);
      return { semantic, logic };
    }),
  );

  const semantic = aggregateAcrossChunks(perChunk.map((r) => r.semantic));
  const logic = aggregateAcrossChunks(perChunk.map((r) => r.logic));

  return fuseAgents(semantic, logic, false);
}

export async function runLayer3(
  cleanText: string,
  opts: { enabled: boolean },
): Promise<Layer3Report> {
  return _runLayer3(cleanText, opts);
}

// ── Self-consistency ─────────────────────────────────────────────────────────

function readSamples(): number {
  const raw = Number(process.env.LAYER2_SAMPLES);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(5, Math.floor(raw));
}

/**
 * Run an agent K times with linearly-spaced temperatures, then vote.
 * Tolerates partial failures (returns the aggregate of successful samples),
 * but throws if ALL samples failed — the route handler maps that to model_unavailable.
 */
async function runWithSelfConsistency(
  agent: AgentFn,
  cleanText: string,
  samples: number,
): Promise<AgentVerdict> {
  const temps = samples === 1 ? [0.1] : linspace(0.1, 0.5, samples);

  const settled = await Promise.allSettled(
    temps.map((t) => agent(cleanText, { temperature: t })),
  );

  const verdicts: AgentVerdict[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") verdicts.push(r.value);
  }

  if (verdicts.length === 0) {
    const firstReject = settled.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    throw firstReject?.reason ?? new Error("All self-consistency samples failed");
  }

  return majorityVote(verdicts);
}

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + step * i);
}

/**
 * Within a single chunk: pick the verdict that the majority of samples agreed on
 * (ties broken by worst), and use the median score (robust to outliers).
 */
function majorityVote(verdicts: AgentVerdict[]): AgentVerdict {
  if (verdicts.length === 1) return verdicts[0];

  const counts: Record<Verdict, number> = { allow: 0, warn: 0, block: 0 };
  for (const v of verdicts) counts[v.verdict]++;

  const top = Math.max(counts.allow, counts.warn, counts.block);
  const winner: Verdict = ([
    "block",
    "warn",
    "allow",
  ] as Verdict[]).find((k) => counts[k] === top)!;

  const sorted = verdicts.map((v) => v.score).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return { verdict: winner, score: median };
}

// ── Across chunks ────────────────────────────────────────────────────────────

/**
 * Worst-verdict fusion across chunks: if any chunk says "block", the whole
 * document is blocked. The score reported is the max — i.e., the most damning
 * fragment.
 */
function aggregateAcrossChunks(verdicts: AgentVerdict[]): AgentVerdict {
  if (verdicts.length === 0) {
    throw new Error("aggregateAcrossChunks: no verdicts to aggregate");
  }
  if (verdicts.length === 1) return verdicts[0];

  const worst: Verdict = verdicts.some((v) => v.verdict === "block")
    ? "block"
    : verdicts.some((v) => v.verdict === "warn")
      ? "warn"
      : "allow";

  const maxScore = verdicts.reduce((max, v) => Math.max(max, v.score), 0);

  return { verdict: worst, score: maxScore };
}
