/**
 * Per-name circuit breaker.
 *
 * Wrap any failure-prone async call (Groq, Supabase, third-party API) and
 * the breaker will fail-fast once a threshold of failures is hit in a sliding
 * window. After `openMs` it transitions to half-open and lets a single probe
 * through; success closes the circuit, failure re-opens it.
 *
 * Threshold defaults to 3 failures inside a 30s window.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitOpts {
  name: string;
  failureThreshold?: number;
  openMs?: number;
}

interface CircuitRecord {
  state: CircuitState;
  failureTimestamps: number[];
  openedAt: number;
  // When in half_open, this guards against concurrent probes.
  probeInFlight: boolean;
}

const DEFAULT_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 30_000;
const DEFAULT_OPEN_MS = 60_000;

const circuits = new Map<string, CircuitRecord>();

function getOrCreate(name: string): CircuitRecord {
  let record = circuits.get(name);
  if (!record) {
    record = {
      state: "closed",
      failureTimestamps: [],
      openedAt: 0,
      probeInFlight: false,
    };
    circuits.set(name, record);
  }
  return record;
}

function pruneWindow(record: CircuitRecord, now: number): void {
  const cutoff = now - FAILURE_WINDOW_MS;
  while (record.failureTimestamps.length > 0 && record.failureTimestamps[0] < cutoff) {
    record.failureTimestamps.shift();
  }
}

export function circuitState(name: string): CircuitState {
  const record = circuits.get(name);
  if (!record) return "closed";
  // If we are open but the cooldown has elapsed, reflect half_open to callers.
  if (record.state === "open" && Date.now() - record.openedAt >= DEFAULT_OPEN_MS) {
    return "half_open";
  }
  return record.state;
}

export async function withCircuit<T>(
  opts: CircuitOpts,
  fn: () => Promise<T>,
): Promise<T> {
  const threshold = opts.failureThreshold ?? DEFAULT_THRESHOLD;
  const openMs = opts.openMs ?? DEFAULT_OPEN_MS;
  const record = getOrCreate(opts.name);
  const now = Date.now();

  // Open -> half_open transition once cooldown elapses.
  if (record.state === "open") {
    if (now - record.openedAt >= openMs) {
      record.state = "half_open";
      record.probeInFlight = false;
    } else {
      throw new Error(`circuit_open:${opts.name}`);
    }
  }

  // Only one probe at a time in half_open; anything else fails fast.
  if (record.state === "half_open") {
    if (record.probeInFlight) {
      throw new Error(`circuit_open:${opts.name}`);
    }
    record.probeInFlight = true;
  }

  try {
    const result = await fn();
    if (record.state === "half_open") {
      // Successful probe — fully reset.
      record.state = "closed";
      record.failureTimestamps = [];
      record.openedAt = 0;
      record.probeInFlight = false;
    } else {
      // Successful call in closed mode — opportunistically prune old failures.
      pruneWindow(record, now);
    }
    return result;
  } catch (err) {
    if (record.state === "half_open") {
      // Probe failed — re-open immediately.
      record.state = "open";
      record.openedAt = Date.now();
      record.probeInFlight = false;
    } else {
      record.failureTimestamps.push(Date.now());
      pruneWindow(record, Date.now());
      if (record.failureTimestamps.length >= threshold) {
        record.state = "open";
        record.openedAt = Date.now();
      }
    }
    throw err;
  }
}
