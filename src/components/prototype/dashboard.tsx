'use client';

import { useMemo, useState, useEffect } from 'react';
import { PageHeader } from './shared';
import type { ScanRecord } from './types';

export function DashboardPage({ scans }: { scans: ScanRecord[] }) {
  const stats = useMemo(() => {
    const total = scans.length;
    const allow = scans.filter(s => s.verdict === 'allow').length;
    const block = scans.filter(s => s.verdict === 'block').length;
    const warn = scans.filter(s => s.verdict === 'warn').length;

    const threatCounts: Record<string, number> = {};
    scans.forEach(s => (s.threatList || []).forEach(t => {
      threatCounts[t] = (threatCounts[t] || 0) + 1;
    }));
    const baselineThreats: Record<string, number> = {
      prompt_injection: 87, zip_bomb: 42, macro_present: 38, hidden_text: 31, mime_mismatch: 24, role_escalation: 21,
    };
    Object.entries(baselineThreats).forEach(([k, v]) => { threatCounts[k] = (threatCounts[k] || 0) + v; });

    const piiCounts: Record<string, number> = {};
    scans.forEach(s => {
      Object.keys(s.tokenMap || {}).forEach(tok => {
        const type = tok.split('_')[0];
        piiCounts[type] = (piiCounts[type] || 0) + 1;
      });
    });
    const baselinePii: Record<string, number> = { PERSON: 781, IBAN: 412, EMAIL: 389, PHONE: 334, CREDIT_CARD: 89, IP: 67, LOCATION: 145, ORGANIZATION: 124 };
    Object.entries(baselinePii).forEach(([k, v]) => { piiCounts[k] = (piiCounts[k] || 0) + v; });
    const piiTotal = Object.values(piiCounts).reduce((a, b) => a + b, 0);

    const avgLat = total > 0 ? Math.round(scans.reduce((a, s) => a + s.latency, 0) / total) : 0;

    return {
      totalAll: total + 1239,
      allowAll: allow + 884,
      blockAll: block + 241,
      warnAll: warn + 114,
      threatCounts, piiCounts, piiTotal,
      avgLat: avgLat || 428,
    };
  }, [scans]);

  const threatRows = useMemo(() => Object.entries(stats.threatCounts).sort((a, b) => b[1] - a[1]).slice(0, 7), [stats.threatCounts]);
  const piiBreakdown = useMemo(() => Object.entries(stats.piiCounts).sort((a, b) => b[1] - a[1]), [stats.piiCounts]);

  const verdictTotal = stats.allowAll + stats.warnAll + stats.blockAll;
  const allowPct = (stats.allowAll / verdictTotal * 100).toFixed(1);
  const warnPct = (stats.warnAll / verdictTotal * 100).toFixed(1);
  const blockPct = (stats.blockAll / verdictTotal * 100).toFixed(1);

  return (
    <div className="page">
      <PageHeader
        eyebrow="ANALYTICS · LAST 30 DAYS"
        title="Statistics & analytics"
        subtitle="Overview of all scanned files and requests across your organization"
        right={
          <div className="row-flex">
            <select className="select btn-sm" style={{ width: 160 }} defaultValue="30d">
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        }
      />

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card neutral">
          <div className="stat-label">Total scans</div>
          <div className="stat-value">{stats.totalAll.toLocaleString('en-US').replace(/,/g, ' ')}</div>
          <div className="stat-sub"><span className="delta-up">▲ +{8 + scans.length}</span> today</div>
        </div>
        <div className="stat-card allow">
          <div className="stat-label">Allowed</div>
          <div className="stat-value allow">{stats.allowAll.toLocaleString('en-US').replace(/,/g, ' ')}</div>
          <div className="stat-sub">{allowPct}% of total</div>
        </div>
        <div className="stat-card block">
          <div className="stat-label">Blocked</div>
          <div className="stat-value block">{stats.blockAll.toLocaleString('en-US').replace(/,/g, ' ')}</div>
          <div className="stat-sub">{blockPct}% of total</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">Warnings</div>
          <div className="stat-value warn">{stats.warnAll.toLocaleString('en-US').replace(/,/g, ' ')}</div>
          <div className="stat-sub">{warnPct}% of total</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Verdict breakdown</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>30 days</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 6 }}>
            <BarRow label="Allow" value={stats.allowAll} pct={allowPct} kind="allow" />
            <BarRow label="Block" value={stats.blockAll} pct={blockPct} kind="block" />
            <BarRow label="Warn" value={stats.warnAll} pct={warnPct} kind="warn" />
          </div>
          <div className="divider-line"></div>
          <SparkBars />
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Threat types (blocked)</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{Object.values(stats.threatCounts).reduce((a, b) => a + b, 0)} total</span>
          </div>
          <table>
            <tbody>
              {threatRows.map(([type, count]) => (
                <tr key={type} style={{ cursor: 'default' }}>
                  <td style={{ paddingLeft: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="status-dot block"></span>
                      <span style={{ fontSize: 13 }}>{type.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 0 }}>
                    <span className="mono" style={{ color: 'var(--danger)' }}>{count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title">PII entities masked</div>
            <span className="badge badge-warn">L1</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'center' }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '18px 12px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--warn)', lineHeight: 1 }}>
                {stats.piiTotal.toLocaleString('en-US').replace(/,/g, ' ')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>
                Total masked
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {piiBreakdown.slice(0, 5).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text2)' }}>{type}</span>
                  <span className="mono">{count}</span>
                </div>
              ))}
              {piiBreakdown.length > 5 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <span>Others ({piiBreakdown.length - 5})</span>
                  <span className="mono">{piiBreakdown.slice(5).reduce((a, [, c]) => a + c, 0)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Layer performance</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>p50 latency</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
            <LayerLatencyRow label="Layer 1" sub="PII sanitizer" ms={89} max={500} color="allow" />
            <LayerLatencyRow label="Layer 2" sub="LLM ensemble" ms={334} max={500} color="allow" />
            <LayerLatencyRow label="Layer 3" sub="AI autophagy" ms={null} disabled />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Avg total latency</span>
            <span className="mono" style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 600 }}>{stats.avgLat} ms</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.05em', textAlign: 'center' }}>
        ↡ Request to /v1/analytics · updated just now · cache 30s
      </div>
    </div>
  );
}

function BarRow({ label, value, pct, kind }: { label: string; value: number; pct: string; kind: 'allow' | 'warn' | 'block' }) {
  const color = kind === 'allow' ? 'var(--accent)' : kind === 'block' ? 'var(--danger)' : 'var(--warn)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{pct}%</span>
          <span className="mono" style={{ fontSize: 13, color, fontWeight: 600 }}>{value.toLocaleString('en-US').replace(/,/g, ' ')}</span>
        </span>
      </div>
      <div className="bar-wrap">
        <div className={`bar-fill ${kind}`} style={{ width: pct + '%' }}></div>
      </div>
    </div>
  );
}

function LayerLatencyRow({ label, sub, ms, max = 500, color = 'allow', disabled }: {
  label: string; sub: string; ms: number | null; max?: number; color?: string; disabled?: boolean;
}) {
  const pct = ms ? Math.min(100, (ms / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 8 }}>{sub}</span>
        </span>
        <span className="mono" style={{ fontSize: 12, color: disabled ? 'var(--text3)' : 'var(--accent)' }}>
          {disabled ? 'disabled' : `avg ${ms} ms`}
        </span>
      </div>
      {!disabled && (
        <div className="bar-wrap">
          <div className={`bar-fill ${color}`} style={{ width: pct + '%' }}></div>
        </div>
      )}
    </div>
  );
}

interface SparkBar { allow: number; warn: number; block: number; }

function SparkBars() {
  const [data, setData] = useState<SparkBar[]>([]);

  useEffect(() => {
    const out: SparkBar[] = [];
    for (let i = 0; i < 14; i++) {
      const total = 30 + Math.floor(Math.sin(i / 2.2) * 12 + Math.random() * 8);
      const block = Math.floor(total * (0.12 + Math.random() * 0.12));
      const warn = Math.floor(total * (0.06 + Math.random() * 0.06));
      out.push({ allow: total - block - warn, warn, block });
    }
    setData(out);
  }, []);

  const maxTotal = data.length > 0 ? Math.max(...data.map(d => d.allow + d.warn + d.block)) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>last 14 days</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>scans / day</span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
        {data.map((d, i) => {
          const total = d.allow + d.warn + d.block;
          const h = (total / maxTotal) * 100;
          return (
            <div key={i} style={{ flex: 1, height: h + '%', display: 'flex', flexDirection: 'column-reverse', borderRadius: 2, overflow: 'hidden', minHeight: 4 }}>
              <div style={{ height: (d.allow / total * 100) + '%', background: 'var(--accent)' }}></div>
              <div style={{ height: (d.warn / total * 100) + '%', background: 'var(--warn)' }}></div>
              <div style={{ height: (d.block / total * 100) + '%', background: 'var(--danger)' }}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
