/**
 * Token-bucket rate limiter keyed by arbitrary string (e.g. API key, IP).
 *
 * Defaults model a 60 rps burst with sustained 1 rps refill. Tune via opts.
 * Idle buckets are dropped after 10 minutes to keep the map bounded.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_CAPACITY = 60;
const DEFAULT_REFILL_PER_SEC = 1;
const IDLE_TTL_MS = 10 * 60_000;
const CLEANUP_INTERVAL_MS = 60_000;

const buckets = new Map<string, Bucket>();

export function checkRate(
  key: string,
  opts?: { capacity?: number; refillPerSec?: number },
): RateLimitResult {
  const capacity = opts?.capacity ?? DEFAULT_CAPACITY;
  const refillPerSec = opts?.refillPerSec ?? DEFAULT_REFILL_PER_SEC;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const refilled = elapsedSec * refillPerSec;
    bucket.tokens = Math.min(capacity, bucket.tokens + refilled);
    bucket.lastRefill = now;
  }

  let allowed = false;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    allowed = true;
  }

  // Time until the bucket is back to capacity (used by callers to set
  // Retry-After or surface in client-facing errors).
  const deficit = capacity - bucket.tokens;
  const resetMs = refillPerSec > 0 ? Math.ceil((deficit / refillPerSec) * 1000) : 0;

  return {
    allowed,
    remaining: Math.floor(bucket.tokens),
    resetMs,
  };
}

function cleanup(): void {
  const cutoff = Date.now() - IDLE_TTL_MS;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}

if (typeof window === "undefined") {
  const handle = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  if (typeof handle === "object" && handle && typeof (handle as { unref?: () => void }).unref === "function") {
    (handle as { unref: () => void }).unref();
  }
}
