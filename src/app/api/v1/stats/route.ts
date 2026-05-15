import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/auditLog";
import { checkRate } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { inc } from "@/lib/metrics";

// Local error type — scan.ts is a read-only team contract; do not edit it.
type StatsErrorCode = "invalid_payload" | "rate_limited" | "engine_error";
interface StatsError { status: "error"; error: StatsErrorCode; message: string; }

const CORS_DEV_ORIGIN = "http://localhost:4000";

function corsHeaders(origin: string | null): HeadersInit {
  if (process.env.NODE_ENV !== "development") return {};
  if (origin !== CORS_DEV_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": CORS_DEV_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
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

function fail(
  status: number,
  error: StatsErrorCode,
  message: string,
  headers: HeadersInit = {},
): NextResponse<StatsError> {
  return NextResponse.json(
    { status: "error", error, message } satisfies StatsError,
    { status, headers },
  );
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const apiKey = request.headers.get("x-api-key");

  try {
    const rate = checkRate(`stats:${clientKey(request)}`);
    if (!rate.allowed) {
      inc("sentry_stats_requests_total");
      return fail(429, "rate_limited", "Rate limit exceeded; retry later.", {
        ...corsHeaders(origin),
        "x-rate-remaining": "0",
      });
    }

    if (!apiKeyOk(apiKey)) {
      return fail(400, "invalid_payload", "Invalid or missing API key.", corsHeaders(origin));
    }

    inc("sentry_stats_requests_total");

    const all = listAudit(undefined);

    // Verdict counts
    const totals = { all: all.length, allow: 0, warn: 0, block: 0, error: 0 };
    for (const e of all) {
      if (e.verdict === "allow") totals.allow++;
      else if (e.verdict === "warn") totals.warn++;
      else if (e.verdict === "block") totals.block++;
      else if (e.verdict === "error") totals.error++;
    }

    // Latency percentiles — only entries that recorded a numeric latency
    const latencyValues = all
      .filter((e) => typeof e.latencyMs === "number")
      .map((e) => e.latencyMs as number)
      .sort((a, b) => a - b);

    let avgMs = 0;
    let p50Ms = 0;
    let p95Ms = 0;
    if (latencyValues.length > 0) {
      const sum = latencyValues.reduce((acc, v) => acc + v, 0);
      avgMs = Math.round(sum / latencyValues.length);
      p50Ms = latencyValues[Math.floor(latencyValues.length * 0.5)];
      p95Ms = latencyValues[Math.floor(latencyValues.length * 0.95)];
    }

    // Aggregate per-threat-type block counts
    const threats: Record<string, number> = {};
    for (const e of all) {
      if (!e.threatsBlocked) continue;
      for (const [key, val] of Object.entries(e.threatsBlocked)) {
        threats[key] = (threats[key] ?? 0) + val;
      }
    }

    const layer3EnabledCount = all.filter((e) => e.layer3Enabled === true).length;
    const generatedAt = new Date().toISOString();

    return NextResponse.json(
      { totals, latency: { avgMs, p50Ms, p95Ms }, threats, layer3EnabledCount, generatedAt },
      {
        headers: {
          ...corsHeaders(origin),
          "x-rate-remaining": String(rate.remaining),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "stats: unhandled error");
    return fail(500, "engine_error", "Internal engine error.", corsHeaders(origin));
  }
}
