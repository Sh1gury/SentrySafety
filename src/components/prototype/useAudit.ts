'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditEntry } from '@/lib/auditLog';

export type AuditRange = '24h' | '7d' | '30d' | 'all';
export type AuditVerdictFilter = 'all' | 'allow' | 'warn' | 'block';

export interface UseAuditOptions {
  range?: AuditRange;
  verdict?: AuditVerdictFilter;
  limit?: number;
}

export interface UseAuditResult {
  serverEntries: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

function rangeToSinceIso(range: AuditRange | undefined): string | null {
  if (!range || range === 'all') return null;
  const now = Date.now();
  const ms =
    range === '24h' ? 24 * 60 * 60 * 1000
    : range === '7d' ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms).toISOString();
}

const POLL_INTERVAL_MS = 2_000;

export function useAudit(opts: UseAuditOptions = {}): UseAuditResult {
  const { range, verdict, limit } = opts;
  const [serverEntries, setServerEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumping `tick` triggers a refetch without changing filter dependencies.
  const [tick, setTick] = useState(0);

  const cancelled = useRef(false);

  const refresh = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    cancelled.current = false;
    const params = new URLSearchParams();
    const since = rangeToSinceIso(range);
    if (since) params.set('since', since);
    if (verdict && verdict !== 'all') params.set('verdict', verdict);
    if (typeof limit === 'number') params.set('limit', String(limit));

    async function load() {
      setLoading(true);
      try {
        const qs = params.toString();
        const res = await fetch('/api/v1/audit' + (qs ? `?${qs}` : ''));
        if (cancelled.current) return;
        if (res.status === 401) {
          setServerEntries([]);
          setTotal(0);
          setError(null);
          return;
        }
        if (!res.ok) {
          setError('Failed to load audit entries.');
          return;
        }
        const body = (await res.json()) as AuditResponse;
        if (cancelled.current) return;
        setServerEntries(body.entries);
        setTotal(body.total);
        setError(null);
      } catch {
        if (!cancelled.current) setError('Network error.');
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(interval);
    };
  }, [range, verdict, limit, tick]);

  return { serverEntries, total, loading, error, refresh };
}
