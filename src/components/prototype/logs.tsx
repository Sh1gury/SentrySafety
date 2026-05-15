'use client';

import { useState, useMemo, useEffect } from 'react';
import { classNames, formatRelTime, VerdictBadge, Badge, PageHeader } from './shared';
import type { ScanRecord } from './types';

export function LogsPage({ scans }: { scans: ScanRecord[] }) {
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<ScanRecord | null>(null);

  const filtered = useMemo(() => {
    return scans.filter(s => {
      if (verdictFilter !== 'all' && s.verdict !== verdictFilter) return false;
      if (typeFilter !== 'all' && s.kind.toLowerCase() !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.id.toLowerCase().includes(q)
          && !(s.filename || '').toLowerCase().includes(q)
          && !(s.preview || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scans, search, verdictFilter, typeFilter]);

  function exportCsv() {
    const headers = ['scan_id', 'timestamp', 'kind', 'verdict', 'pii_count', 'threats', 'latency_ms'];
    const rows = filtered.map(s => [
      s.id,
      new Date(s.ts).toISOString(),
      s.kind,
      s.verdict,
      s.pii,
      (s.threatList || []).join(';'),
      s.latency,
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
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{filtered.length} / {scans.length}</span>
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
        <select className="select" style={{ width: 150, flex: '0 0 auto' }} value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)}>
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
            ) : filtered.map(s => (
              <tr
                key={s.id}
                onClick={() => setSelected(s)}
                className={classNames(
                  selected?.id === s.id && 'selected',
                  s.verdict === 'block' && 'row-block',
                  s.verdict === 'warn' && 'row-warn',
                )}
              >
                <td className="mono" style={{ color: 'var(--text)' }}>{s.id.replace(/_(\w{6}).*/, '_$1')}</td>
                <td className="cell-dim" title={new Date(s.ts).toLocaleString()}>{formatRelTime(s.ts)}</td>
                <td><span className="badge badge-neutral">{s.kind}</span></td>
                <td><VerdictBadge verdict={s.verdict} /></td>
                <td className="mono" style={{ textAlign: 'right', color: s.pii > 0 ? 'var(--warn)' : 'var(--text3)' }}>{s.pii}</td>
                <td>
                  {(s.threatList || []).length === 0
                    ? <span className="cell-dim">—</span>
                    : (s.threatList || []).slice(0, 2).map(t => (
                        <span key={t} className={s.verdict === 'block' ? 'badge badge-block' : 'badge badge-warn'} style={{ marginRight: 4 }}>{t.replace(/_/g, ' ')}</span>
                      ))
                  }
                  {(s.threatList || []).length > 2 && <span className="cell-dim">+{s.threatList.length - 2}</span>}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>{s.latency} ms</td>
                <td>
                  <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setSelected(s); }}>Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
        <span>Showing {filtered.length} of {scans.length} records</span>
        <span>↻ auto-refresh every 30s</span>
      </div>

      {selected && <ScanDetailSlideout scan={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ScanDetailSlideout({ scan, onClose }: { scan: ScanRecord; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm">Copy JSON</button>
            <button className="btn btn-sm">Re-run scan</button>
          </div>
        </div>
      </div>
    </>
  );
}
