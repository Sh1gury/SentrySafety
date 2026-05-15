/**
 * Tiny in-memory TTL cache.
 *
 * - Lazy eviction on read.
 * - Periodic sweep every 60s (server-side only — guarded against running
 *   during static build / browser bundles).
 * - Hard cap of 1000 entries; oldest insertion order evicted when exceeded.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;
const SWEEP_INTERVAL_MS = 60_000;

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // If key already exists, delete first so re-insertion refreshes insertion order.
  if (store.has(key)) {
    store.delete(key);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  // Enforce size cap by dropping the oldest entries (Map preserves insertion order).
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function cacheSize(): number {
  return store.size;
}

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

// Only schedule background sweep on the server. `typeof window === "undefined"`
// prevents the timer from being attached during a client bundle, and the
// `unref` keeps Node from holding the process open just for this interval.
if (typeof window === "undefined") {
  const handle = setInterval(sweep, SWEEP_INTERVAL_MS);
  if (typeof handle === "object" && handle && typeof (handle as { unref?: () => void }).unref === "function") {
    (handle as { unref: () => void }).unref();
  }
}
