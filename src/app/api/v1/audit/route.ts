import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/auditLog";
import { checkRate } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { inc } from "@/lib/metrics";

// Local error type — scan.ts is a read-only team contract; do not edit it.
type AuditErrorCode = "invalid_payload" | "rate_limited" | "engine_error";
interface AuditError { status: "error"; error: AuditErrorCode; message: string; }

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
  error: AuditErrorCode,
  message: string,
  headers: HeadersInit = {},
): NextResponse<AuditError> {
  return NextResponse.json(
    { status: "error", error, message } satisfies AuditError,
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
    const rate = checkRate(`audit:${clientKey(request)}`);
    if (!rate.allowed) {
      inc("sentry_audit_requests_total");
      return fail(429, "rate_limited", "Rate limit exceeded; retry later.", {
        ...corsHeaders(origin),
        "x-rate-remaining": "0",
      });
    }

    if (!apiKeyOk(apiKey)) {
      return fail(400, "invalid_payload", "Invalid or missing API key.", corsHeaders(origin));
    }

    inc("sentry_audit_requests_total");

    const url = request.nextUrl;
    const rawLimit = Number(url.searchParams.get("limit"));
    // Clamp to [1, 1000]; fallback to 100 when param is absent or NaN.
    const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 100 : Math.min(rawLimit, 1000);

    const rawOffset = Number(url.searchParams.get("offset"));
    const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    const sinceParam = url.searchParams.get("since");
    const untilParam = url.searchParams.get("until");
    const verdictParam = url.searchParams.get("verdict");

    const sinceMs = sinceParam ? Date.parse(sinceParam) : NaN;
    const untilMs = untilParam ? Date.parse(untilParam) : NaN;
    const verdictFilter =
      verdictParam === "allow" || verdictParam === "warn" || verdictParam === "block"
        ? verdictParam
        : null;

    let filtered = listAudit(undefined);
    if (!Number.isNaN(sinceMs)) {
      filtered = filtered.filter((e) => new Date(e.ts).getTime() >= sinceMs);
    }
    if (!Number.isNaN(untilMs)) {
      filtered = filtered.filter((e) => new Date(e.ts).getTime() <= untilMs);
    }
    if (verdictFilter) {
      filtered = filtered.filter((e) => e.verdict === verdictFilter);
    }

    const total = filtered.length;
    const entries = filtered.slice(offset, offset + limit);

    return NextResponse.json(
      { entries, total, limit, offset },
      {
        headers: {
          ...corsHeaders(origin),
          "x-rate-remaining": String(rate.remaining),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "audit: unhandled error");
    return fail(500, "engine_error", "Internal engine error.", corsHeaders(origin));
  }
}
