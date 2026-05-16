'use client';

import { useState, useMemo, useEffect } from 'react';
import { classNames, formatRelTime, VerdictBadge, Badge, PageHeader } from './shared';
import { useAudit, type AuditRange, type AuditVerdictFilter } from './useAudit';
import { useScan } from './useScan';
import type { ScanRecord, ScanConfig, Verdict } from './types';
import type { AuditEntry } from '@/lib/auditLog';

// Reduced-detail row backed by a server-side audit record (no preview, no token map).
interface ServerRow {
  source: 'server';
  id: string;
  ts: number;
  verdict: Verdict;
  kind: string;
  pii: number;
  threats: number;
  threatList: string[];
  latency: number;
  bytes: number;
  raw: AuditEntry;
}

interface SessionRow {
  source: 'session';
  scan: ScanRecord;
}

type Row = SessionRow | ServerRow;

function auditToRow(e: AuditEntry): ServerRow | null {
  // Skip rows that aren't a real verdict (e.g. "error") — those would break VerdictBadge.
  if (e.verdict !== 'allow' && e.verdict !== 'warn' && e.verdict !== 'block') return null;
  const threatsBlocked = e.threatsBlocked ?? {};
  const threatList = Object.entries(threatsBlocked)
    .filter(([, c]) => typeof c === 'number' && c > 0)
    .map(([k]) => k);
  const threats = threatList.reduce((sum, k) => sum + (threatsBlocked[k] ?? 0), 0);
  return {
    source: 'server',
    id: e.scanId,
    ts: new Date(e.ts).getTime(),
    verdict: e.verdict,
    kind: 'server',
    pii: 0,
    threats,
    threatList,
    latency: e.latencyMs ?? 0,
    bytes: e.inputLength,
    raw: e,
  };
}

function rowId(r: Row): string {
  return r.source === 'session' ? r.scan.id : r.id;
}
function rowTs(r: Row): number {
  return r.source === 'session' ? r.scan.ts : r.ts;
}
function rowVerdict(r: Row): Verdict {
  return r.source === 'session' ? r.scan.verdict : r.verdict;
}
function rowKind(r: Row): string {
  return r.source === 'session' ? r.scan.kind : r.kind;
}
function rowPii(r: Row): number {
  return r.source === 'session' ? r.scan.pii : r.pii;
}
function rowThreatList(r: Row): string[] {
  return r.source === 'session' ? (r.scan.threatList || []) : r.threatList;
}
function rowLatency(r: Row): number {
  return r.source === 'session' ? r.scan.latency : r.latency;
}
function rowSearchHaystack(r: Row): string {
  if (r.source === 'session') {
    return [r.scan.id, r.scan.filename ?? '', r.scan.preview ?? ''].join(' ').toLowerCase();
  }
  return r.id.toLowerCase();
}

export function LogsPage({
  scans,
  addScan,
  config,
}: {
  scans: ScanRecord[];
  addScan: (s: ScanRecord) => void;
  config: ScanConfig;
}) {
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<AuditVerdictFilter>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState<AuditRange>('all');
  const [selected, setSelected] = useState<ScanRecord | null>(null);

  const { serverEntries, total: serverTotal } = useAudit({
    range: rangeFilter,
    verdict: verdictFilter,
  });

  const merged: Row[] = useMemo(() => {
    const sessionIds = new Set(scans.map(s => s.id));
    const sessionRows: SessionRow[] = scans.map(s => ({ source: 'session', scan: s }));
    const serverRows: ServerRow[] = [];
    for (const e of serverEntries) {
      if (sessionIds.has(e.scanId)) continue;
      const row = auditToRow(e);
      if (row) serverRows.push(row);
    }
    return [...sessionRows, ...serverRows].sort((a, b) => rowTs(b) - rowTs(a));
  }, [scans, serverEntries]);

  const filtered = useMemo(() => {
    return merged.filter(r => {
      if (verdictFilter !== 'all' && rowVerdict(r) !== verdictFilter) return false;
      if (typeFilter !== 'all' && rowKind(r).toLowerCase() !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!rowSearchHaystack(r).includes(q)) return false;
      }
      return true;
    });
  }, [merged, search, verdictFilter, typeFilter]);

  // Y = total visible records (session + de-duped server). Server "total" is the
  // upper bound from the API; we combine to give a single "of" denominator.
  const totalDenominator = Math.max(merged.length, scans.length + serverTotal);

  function exportCsv() {
    const headers = ['scan_id', 'timestamp', 'kind', 'verdict', 'pii_count', 'threats', 'latency_ms'];
    const rows = filtered.map(r => [
      rowId(r),
      new Date(rowTs(r)).toISOString(),
      rowKind(r),
      rowVerdict(r),
      rowPii(r),
      rowThreatList(r).join(';'),
      rowLatency(r),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentry_scans.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="Scan logs"
        subtitle="All scans in real time. Click a row for full details."
        right={
          <div className="row-flex">
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{filtered.length} / {totalDenominator}</span>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-wrap" style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <span className="input-icon">⌕</span>
          <input
            className="input"
            placeholder="Search by scan ID, filename or content…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          style={{ width: 150, flex: '0 0 auto' }}
          value={verdictFilter}
          onChange={e => setVerdictFilter(e.target.value as AuditVerdictFilter)}
        >
          <option value="all">All verdicts</option>
          <option value="allow">allow</option>
          <option value="warn">warn</option>
          <option value="block">block</option>
        </select>
        <select className="select" style={{ width: 130, flex: '0 0 auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="text">text</option>
          <option value="pdf">PDF</option>
          <option value="docx">DOCX</option>
          <option value="zip">ZIP</option>
          <option value="txt">TXT</option>
        </select>
        <select
          className="select"
          style={{ width: 130, flex: '0 0 auto' }}
          value={rangeFilter}
          onChange={e => setRangeFilter(e.target.value as AuditRange)}
        >
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <span style={{ flex: 1 }}></span>
        <button className="btn btn-sm" onClick={exportCsv}>
          <span className="mono" style={{ fontSize: 11 }}>↓</span> Export CSV
        </button>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Scan ID</th>
              <th>Time</th>
              <th>Type</th>
              <th>Verdict</th>
              <th style={{ textAlign: 'right' }}>PII</th>
              <th>Threats</th>
              <th style={{ textAlign: 'right' }}>Latency</th>
              <th style={{ width: 1 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  <div className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 6 }}>NO RESULTS</div>
                  <div style={{ fontSize: 13 }}>No scans match the current filters</div>
                </td>
              </tr>
            ) : filtered.map(r => {
              const id = rowId(r);
              const ts = rowTs(r);
              const verdict = rowVerdict(r);
              const kind = rowKind(r);
              const pii = rowPii(r);
              const threatList = rowThreatList(r);
              const latency = rowLatency(r);
              const isSession = r.source === 'session';
              const sessionScan = isSession ? r.scan : null;
              return (
                <tr
                  key={id}
                  onClick={() => sessionScan && setSelected(sessionScan)}
                  className={classNames(
                    selected?.id === id && 'selected',
                    verdict === 'block' && 'row-block',
                    verdict === 'warn' && 'row-warn',
                  )}
                  style={!isSession ? { cursor: 'default' } : undefined}
                >
                  <td className="mono" style={{ color: 'var(--text)' }}>
                    {id.replace(/_(\w{6}).*/, '_$1')}
                    {!isSession && <span className="badge badge-neutral" style={{ marginLeft: 6, fontSize: 9 }}>Server record</span>}
                  </td>
                  <td className="cell-dim" title={new Date(ts).toLocaleString()}>{formatRelTime(ts)}</td>
                  <td><span className="badge badge-neutral">{kind}</span></td>
                  <td><VerdictBadge verdict={verdict} /></td>
                  <td className="mono" style={{ textAlign: 'right', color: pii > 0 ? 'var(--warn)' : 'var(--text3)' }}>{pii}</td>
                  <td>
                    {threatList.length === 0
                      ? <span className="cell-dim">—</span>
                      : threatList.slice(0, 2).map(t => (
                          <span key={t} className={verdict === 'block' ? 'badge badge-block' : 'badge badge-warn'} style={{ marginRight: 4 }}>{t.replace(/_/g, ' ')}</span>
                        ))
                    }
                    {threatList.length > 2 && <span className="cell-dim">+{threatList.length - 2}</span>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{latency} ms</td>
                  <td>
                    {sessionScan
                      ? <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setSelected(sessionScan); }}>Details</button>
                      : <span className="cell-dim mono" style={{ fontSize: 10 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
        <span>Showing {filtered.length} of {totalDenominator} records</span>
      </div>

      {selected && (
        <ScanDetailSlideout
          scan={selected}
          onClose={() => setSelected(null)}
          addScan={addScan}
          config={config}
        />
      )}
    </div>
  );
}

function ScanDetailSlideout({
  scan,
  onClose,
  addScan,
  config,
}: {
  scan: ScanRecord;
  onClose: () => void;
  addScan: (s: ScanRecord) => void;
  config: ScanConfig;
}) {
  const [copied, setCopied] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const { runScan } = useScan();
  // File scans can't be re-run — we never retain the original File handle.
  const canRerun = scan.kind === 'text';

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(scan, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be unavailable in some browsers/contexts; silent.
    }
  }

  async function handleRerun() {
    if (!canRerun || rerunning) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const next = await runScan(scan.preview, 'text', config);
      addScan(next);
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : 'Re-run failed');
    } finally {
      setRerunning(false);
    }
  }

  return (
    <>
      <div className="slideout-overlay" onClick={onClose}></div>
      <div className="slideout">
        <div className="slideout-head">
          <div className="slideout-title">
            <VerdictBadge verdict={scan.verdict} />
            <span className="mono" style={{ fontSize: 13 }}>{scan.id}</span>
          </div>
          <button className="slideout-close" onClick={onClose}>✕</button>
        </div>
        <div className="slideout-body">
          <div className={classNames('verdict-header', scan.verdict)} style={{ marginBottom: 16 }}>
            <div>
              <div className={classNames('verdict-big', scan.verdict)}>
                <span className="verdict-dot"></span>
                {scan.verdict.toUpperCase()}
              </div>
              <div className="verdict-sub">{new Date(scan.ts).toLocaleString('en-US')}</div>
            </div>
            <div className="scan-meta-right">
              <div className="scan-id">{scan.id}</div>
              <div className="latency">{scan.latency} ms · {(scan.bytes / 1024).toFixed(1)} KB</div>
            </div>
          </div>

          <div className="section-label">Content</div>
          <div className="card">
            <div style={{ fontSize: 11.5, color: 'var(--text2)', fontFamily: 'var(--mono)', lineHeight: 1.6, padding: 4 }}>
              {scan.preview}
            </div>
          </div>

          <div className="section-label">Metadata</div>
          <div className="card">
            <div className="kv-grid">
              <div className="k">Filename</div><div className="v">{scan.filename || '—'}</div>
              <div className="k">Kind</div><div className="v">{scan.kind}</div>
              <div className="k">Size</div><div className="v">{scan.bytes.toLocaleString()} bytes</div>
              <div className="k">Latency</div><div className="v">{scan.latency} ms</div>
              <div className="k">PII masked</div><div className="v">{scan.pii}</div>
              <div className="k">Threats</div><div className="v">{(scan.threatList || []).join(', ') || '—'}</div>
            </div>
          </div>

          <div className="section-label">Defense layers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="layer-name">LAYER 1 · PII Sanitizer</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{scan.pii} entities masked · {scan.layer1.removed_paragraphs} paragraphs removed</div>
              </div>
              <VerdictBadge verdict={scan.layer1.verdict} />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="layer-name">LAYER 2 · LLM Ensemble</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>score: <span className="mono">{scan.layer2.score.toFixed(2)}</span> · {scan.layer2.demoMode ? <Badge kind="mock">MOCK</Badge> : null}</div>
                </div>
                <VerdictBadge verdict={scan.layer2.verdict} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                <span>semantic <span style={{ color: 'var(--text)' }}>{scan.layer2.agents.semantic.score.toFixed(2)}</span></span>
                <span>logic <span style={{ color: 'var(--text)' }}>{scan.layer2.agents.logic.score.toFixed(2)}</span></span>
              </div>
            </div>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scan.layer3.enabled ? 1 : 0.55 }}>
              <div>
                <div className="layer-name">LAYER 3 · AI Autophagy</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  {scan.layer3.enabled
                    ? `${scan.layer3.synthetic_paragraphs_removed || 0} synthetic paragraphs · conf ${(scan.layer3.confidence || 0).toFixed(2)}`
                    : 'Disabled in configuration'}
                </div>
              </div>
              {scan.layer3.enabled
                ? <VerdictBadge verdict="allow" />
                : <span className="badge badge-mock">OFF</span>}
            </div>
          </div>

          {Object.keys(scan.tokenMap || {}).length > 0 && (
            <>
              <div className="section-label">Token map <span className="badge badge-warn" style={{ marginLeft: 8 }}>SENSITIVE</span></div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead><tr><th>Token</th><th>Original</th></tr></thead>
                  <tbody>
                    {Object.entries(scan.tokenMap).map(([t, v]) => (
                      <tr key={t} style={{ cursor: 'default' }}>
                        <td className="mono" style={{ color: 'var(--accent)' }}>{t}</td>
                        <td style={{ fontSize: 13 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {rerunError && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{rerunError}</div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {rerunning && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>Re-running…</span>
            )}
            <button className="btn btn-sm" onClick={handleCopyJson}>
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <button
              className="btn btn-sm"
              onClick={handleRerun}
              disabled={!canRerun || rerunning}
              title={canRerun ? undefined : 'Only text scans can be re-run (file handle not retained).'}
            >
              Re-run scan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
