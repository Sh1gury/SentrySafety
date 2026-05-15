/**
 * Sentry Safety — in-memory audit log.
 *
 * Ring buffer capped at MAX_ENTRIES. Newest entries are appended to the tail;
 * once full, the oldest entry is evicted. NEVER stores raw content/body —
 * only metadata that is safe to inspect (scanId, verdict, length, etc).
 */

export interface AuditEntry {
  ts: string;
  scanId: string;
  verdict: "allow" | "warn" | "block" | "error";
  errorCode?: string;
  layer1Verdict?: "allow" | "warn" | "block";
  layer2Verdict?: "allow" | "warn" | "block";
  layer3Enabled?: boolean;
  latencyMs?: number;
  layer1Ms?: number;
  layer2Ms?: number;
  inputLength: number;
  threatsBlocked?: Record<string, number>;
}

const MAX_ENTRIES = 1000;

const buffer: AuditEntry[] = [];

export function recordAudit(entry: AuditEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

export function listAudit(limit?: number): AuditEntry[] {
  // newest first
  const reversed = buffer.slice().reverse();
  if (typeof limit === "number" && limit >= 0) {
    return reversed.slice(0, limit);
  }
  return reversed;
}

export function listAuditSince(sinceMs: number): AuditEntry[] {
  // newest first; only entries with ts >= sinceMs
  const out: AuditEntry[] = [];
  for (let i = buffer.length - 1; i >= 0; i--) {
    const entry = buffer[i];
    if (new Date(entry.ts).getTime() >= sinceMs) {
      out.push(entry);
    }
  }
  return out;
}

export function auditCount(): number {
  return buffer.length;
}
