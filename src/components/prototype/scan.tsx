'use client';

import { useState, useRef } from 'react';
import {
  classNames, Toggle, Badge, Pill, VerdictBadge, Collapsible, PageHeader,
  PII_ENTITIES,
} from './shared';
import { PLACEHOLDER_TEXT, PRESETS } from './samples';
import type { ScanRecord, ScanConfig } from './types';
import { useScan } from './useScan';
import { XRayView } from './xray';

const SAMPLE_PDFS: { id: string; label: string; file: string }[] = [
  { id: 'poisoned', label: 'Try: Poisoned vendor PDF', file: 'vendor-quote-poisoned.pdf' },
  { id: 'resume',   label: 'Try: PII-heavy resume',     file: 'resume-pii.pdf' },
  { id: 'combo',    label: 'Try: Combo attack',         file: 'combo-attack.pdf' },
];

interface ScanPageProps {
  config: ScanConfig;
  setConfig: (fn: (c: ScanConfig) => ScanConfig) => void;
  addScan: (s: ScanRecord) => void;
}

export function ScanPage({ config, setConfig, addScan }: ScanPageProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xray, setXray] = useState<boolean>(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { runScan: doScan } = useScan();

  const stages = ['ingest', 'sanitize', 'threat-detect', 'autophagy', 'compose'];

  function toggleEntity(ent: string) {
    setConfig(c => {
      const has = c.privacy.entities_to_mask.includes(ent);
      const next = has
        ? c.privacy.entities_to_mask.filter(x => x !== ent)
        : [...c.privacy.entities_to_mask, ent];
      return { ...c, privacy: { ...c.privacy, mask_pii: true, entities_to_mask: next } };
    });
  }

  function clearAll() {
    setText('');
    setFile(null);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function runScanWith(opts: { text: string; file: File | null }) {
    if (!opts.text && !opts.file) return;
    setScanning(true);
    setResult(null);
    setError(null);
    setScanStage(0);

    // Visual stage animation runs in parallel with real request.
    // We resolve when BOTH the animation has played through enough stages AND the response arrives.
    const stageAnimation = (async () => {
      await new Promise(r => setTimeout(r, 200)); setScanStage(1);
      await new Promise(r => setTimeout(r, 250)); setScanStage(2);
      await new Promise(r => setTimeout(r, 280)); setScanStage(3);
      if (config.integrity.check_autophagy) await new Promise(r => setTimeout(r, 200));
      setScanStage(4);
      await new Promise(r => setTimeout(r, 180));
    })();

    try {
      const kind = opts.file ? 'file' : 'text';
      const [scanResult] = await Promise.all([
        doScan(opts.text, kind, config, opts.file),
        stageAnimation,
      ]);
      setResult(scanResult);
      addScan(scanResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown scan error';
      setError(message);
    } finally {
      setScanning(false);
    }
  }

  async function runScan() {
    return runScanWith({ text, file });
  }

  async function loadSamplePdf(filename: string) {
    setError(null);
    setLoadingSample(filename);
    try {
      const res = await fetch(`/demo/${filename}`);
      if (!res.ok) {
        setError(`Sample not yet generated — see public/demo/ (${filename})`);
        return;
      }
      const blob = await res.blob();
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });
      setFile(pdfFile);
      setText('');
      // Auto-run the scan with this file so the demo flow is one-click.
      await runScanWith({ text: '', file: pdfFile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sample';
      setError(`Sample not yet generated — see public/demo/ (${message})`);
    } finally {
      setLoadingSample(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="LAYER 1 · 2 · 3"
        title="Content scan"
        subtitle="Paste text or upload a file — it will pass through three layers of defense before reaching the LLM"
        right={
          <div className="row-flex">
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>STATUS</span>
            <span className="badge badge-allow dot">ONLINE</span>
          </div>
        }
      />

      <div className="layout-sidebar">
        <div className="sidebar-stack">
          <SettingsPanel
            config={config}
            setConfig={setConfig}
            xray={xray}
            setXray={setXray}
          />
          <EntitiesPanel
            entities={config.privacy.entities_to_mask}
            onToggle={toggleEntity}
            disabled={!config.privacy.mask_pii}
          />
        </div>

        <div>
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">Input content</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                {text.length} chars · {file ? '1 file' : 'no files'}
              </div>
            </div>

            {xray ? (
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, letterSpacing: '0.08em' }}>
                  X-RAY VIEW · hidden characters revealed
                </div>
                <XRayView text={text} />
              </div>
            ) : (
              <textarea
                className="textarea"
                rows={7}
                placeholder={'Paste text to scan…\n\nExample: ' + PLACEHOLDER_TEXT}
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={scanning}
              />
            )}

            <div className="preset-row">
              <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center', marginRight: 4 }}>SAMPLES</span>
              <button className="preset-btn" onClick={() => setText(PRESETS.pii)}>PII heavy</button>
              <button className="preset-btn" onClick={() => setText(PRESETS.injection)}>Prompt injection</button>
              <button className="preset-btn" onClick={() => setText(PRESETS.mixed)}>Mixed attack</button>
              <button className="preset-btn" onClick={() => setText(PRESETS.clean)}>Clean text</button>
            </div>

            <div className="preset-row" style={{ marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center', marginRight: 4 }}>SAMPLE PDFs</span>
              {SAMPLE_PDFS.map(s => (
                <button
                  key={s.id}
                  className="preset-btn"
                  onClick={() => loadSamplePdf(s.file)}
                  disabled={scanning || loadingSample !== null}
                  title={`/demo/${s.file}`}
                >
                  {loadingSample === s.file ? 'Loading…' : s.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              {!file ? (
                <div
                  className={classNames('dropzone', dragging && 'dragging')}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className="dropzone-icon">↑</div>
                  <div>Drop a file or <span className="accent-link">browse</span></div>
                  <div className="dropzone-hint">PDF · DOCX · TXT · ZIP · up to 10 MB</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                    accept=".pdf,.docx,.txt,.zip"
                  />
                </div>
              ) : (
                <div className="file-chip">
                  <span className="ico" style={{ width: 22, height: 22, background: 'var(--surface3)', borderRadius: 4, fontSize: 10, color: 'var(--accent)' }}>
                    {(file.name.split('.').pop() || '?').toUpperCase().slice(0, 4)}
                  </span>
                  <span className="filename">{file.name}</span>
                  <span className="filesize">{(file.size / 1024).toFixed(1)} KB</span>
                  <span className="remove" onClick={() => setFile(null)}>✕</span>
                </div>
              )}
            </div>

            <div className="row-flex-end" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={clearAll} disabled={scanning}>Clear</button>
              <button
                className="btn btn-primary"
                onClick={runScan}
                disabled={scanning || (!text && !file)}
              >
                {scanning ? 'Scanning…' : 'Run scan'} <span style={{ marginLeft: 2 }}>→</span>
              </button>
            </div>
          </div>

          {scanning && (
            <div className="scanning-banner fade-in" style={{ marginTop: 16 }}>
              <span className="pulse"></span>
              <span className="stage">
                <span className="stage-num">[{scanStage + 1}/{stages.length}]</span>{' '}
                Running: {stages[scanStage]}…
              </span>
              <span style={{ flex: 1 }}></span>
              <span className="mono" style={{ color: 'var(--text3)', fontSize: 11 }}>esc to abort</span>
            </div>
          )}

          {error && !scanning && (
            <div className="card fade-in" style={{ marginTop: 16, background: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--danger)', letterSpacing: '0.1em', marginBottom: 6 }}>SCAN ERROR</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{error}</div>
            </div>
          )}

          {result && !scanning && (
            <div className="card fade-in" style={{ marginTop: 16 }}>
              <ResultBlock result={result} />
            </div>
          )}

          {!result && !error && !scanning && (
            <div className="card" style={{ marginTop: 16, padding: 28, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: 6 }}>
                AWAITING INPUT
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Paste text or upload a file, then press <span className="kbd">Run scan</span>
              </div>
              <div className="row-flex" style={{ justifyContent: 'center', marginTop: 14, gap: 24, color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--mono)' }}>
                <span>L1 · PII Sanitizer {config.privacy.mask_pii ? <span style={{ color: 'var(--accent)' }}>ON</span> : <span>OFF</span>}</span>
                <span>L2 · Threat Detect <span style={{ color: 'var(--accent)' }}>ON</span></span>
                <span>L3 · Autophagy {config.integrity.check_autophagy ? <span style={{ color: 'var(--accent)' }}>ON</span> : <span>OFF</span>}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  config,
  setConfig,
  xray,
  setXray,
}: {
  config: ScanConfig;
  setConfig: (fn: (c: ScanConfig) => ScanConfig) => void;
  xray: boolean;
  setXray: (v: boolean) => void;
}) {
  function set(path: string, val: boolean) {
    setConfig(c => {
      const next = JSON.parse(JSON.stringify(c)) as ScanConfig;
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = val;
      return next;
    });
  }

  return (
    <div className="card">
      <div className="card-title">Scan settings</div>
      <div className="toggle-row">
        <div className="toggle-info">
          <div className="toggle-label">PII masking <span className="layer-tag">L1</span></div>
          <div className="toggle-desc">Replaces sensitive data (name, IBAN, phone, email) with tokens before forwarding to the AI</div>
        </div>
        <Toggle on={config.privacy.mask_pii} onChange={v => set('privacy.mask_pii', v)} />
      </div>
      <div className="toggle-row">
        <div className="toggle-info">
          <div className="toggle-label">Autophagy check <span className="layer-tag">L3</span></div>
          <div className="toggle-desc">Detects AI-generated text to prevent self-replication inside LLM pipelines</div>
        </div>
        <Toggle on={config.integrity.check_autophagy} onChange={v => set('integrity.check_autophagy', v)} />
      </div>
      <div className="toggle-row">
        <div className="toggle-info">
          <div className="toggle-label">X-Ray view <span className="layer-tag">DEMO</span></div>
          <div className="toggle-desc">Reveals invisible attacker text: zero-width chars, bidi-overrides, Cyrillic homoglyphs, hidden system prompts</div>
        </div>
        <Toggle on={xray} onChange={setXray} />
      </div>
      <div className="divider-line"></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-dot allow"></span>
          Threat detection <span className="layer-tag" style={{ display: 'inline-block', verticalAlign: 'middle', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em' }}>L2</span>
        </span>
        <span style={{ color: 'var(--accent)' }}>ALWAYS ON</span>
      </div>
    </div>
  );
}

function EntitiesPanel({ entities, onToggle, disabled }: { entities: string[]; onToggle: (e: string) => void; disabled: boolean }) {
  return (
    <div className={classNames('card', disabled && 'fade-disabled')} style={disabled ? { opacity: 0.5 } : undefined}>
      <div className="card-title-row">
        <div className="card-title">PII entities</div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{entities.length}/{PII_ENTITIES.length}</span>
      </div>
      <div className="tag-row">
        {PII_ENTITIES.map(ent => (
          <Pill key={ent} on={entities.includes(ent)} onClick={() => onToggle(ent)}>
            {ent}
          </Pill>
        ))}
      </div>
      <div className="divider-line"></div>
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55, fontFamily: 'var(--mono)' }}>
        Active entities are replaced with tokens like <span style={{ color: 'var(--accent)' }}>PERSON_1</span>, <span style={{ color: 'var(--accent)' }}>IBAN_2</span>, etc.
      </div>
    </div>
  );
}

function ResultBlock({ result }: { result: ScanRecord }) {
  const verdictCopy = {
    allow: 'Content is safe to forward',
    warn: 'Content passed with caveats — manual review recommended',
    block: 'Content blocked — threats detected',
  };

  return (
    <>
      <div className={classNames('verdict-header', result.verdict)}>
        <div>
          <div className={classNames('verdict-big', result.verdict)}>
            <span className="verdict-dot"></span>
            {result.verdict.toUpperCase()}
          </div>
          <div className="verdict-sub">{verdictCopy[result.verdict]}</div>
        </div>
        <div className="scan-meta-right">
          <div className="scan-id">{result.id}</div>
          <div className="latency">latency: {result.latency} ms</div>
        </div>
      </div>

      <div className="section-label">Three layers of defense</div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className={classNames('layer-card', 'active-layer')}>
          <div className="layer-name">LAYER 1</div>
          <div className="layer-title">PII Sanitizer</div>
          <div className="layer-meta">
            <VerdictBadge verdict={result.layer1.verdict} />
            <span className="layer-meta-num">{result.pii} masked</span>
          </div>
          <div className="layer-desc">
            {result.pii > 0
              ? `${[...new Set((result.piiHits || []).map(h => h.type))].join(', ')} → tokens`
              : 'No PII detected'}
          </div>
        </div>

        <div className={classNames('layer-card',
          result.layer2.verdict === 'block' ? 'block-layer'
          : result.layer2.verdict === 'warn' ? 'warn-layer' : 'active-layer'
        )}>
          <div className="layer-name">LAYER 2</div>
          <div className="layer-title">Threat Detection</div>
          <div className="layer-meta">
            <VerdictBadge verdict={result.layer2.verdict} />
            {result.layer2.demoMode && <Badge kind="mock">MOCK</Badge>}
          </div>
          <div className="layer-desc">
            LLM ensemble: semantic <span className="mono" style={{ color: 'var(--text)' }}>{result.layer2.agents.semantic.score.toFixed(2)}</span>
            {' / '}
            logic <span className="mono" style={{ color: 'var(--text)' }}>{result.layer2.agents.logic.score.toFixed(2)}</span>
          </div>
        </div>

        <div className={classNames('layer-card', result.layer3.enabled ? 'active-layer' : 'disabled')}>
          <div className="layer-name">LAYER 3</div>
          <div className="layer-title">AI Autophagy</div>
          <div className="layer-meta">
            {result.layer3.enabled
              ? <><VerdictBadge verdict="allow" /><span className="layer-meta-num">conf {(result.layer3.confidence || 0).toFixed(2)}</span></>
              : <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>DISABLED</span>}
          </div>
          <div className="layer-desc">
            {result.layer3.enabled
              ? `${result.layer3.synthetic_paragraphs_removed} synthetic paragraphs removed`
              : 'AI-generated text detection'}
          </div>
        </div>
      </div>

      {result.threatList && result.threatList.length > 0 && (
        <>
          <div className="section-label">Threats detected</div>
          <div className="card" style={{ background: 'var(--danger-bg)', borderColor: 'rgba(239,68,68,0.2)', padding: '14px 16px', marginBottom: 14 }}>
            <div className="tag-row">
              {result.threatList.map(t => (
                <span key={t} className="badge badge-block dot">{t}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {Object.keys(result.tokenMap || {}).length > 0 && (
        <Collapsible
          title={<>Tokenization map — {Object.keys(result.tokenMap).length} entities <span className="badge badge-warn" style={{ marginLeft: 8 }}>SENSITIVE</span></>}
          defaultOpen={false}
        >
          <table>
            <thead><tr><th>Token</th><th>Original value</th><th>Type</th></tr></thead>
            <tbody>
              {(result.piiHits || Object.entries(result.tokenMap).map(([token, value]) => ({
                token, value, type: token.split('_')[0],
              }))).map((h, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--accent)' }}>{h.token}</td>
                  <td>{h.value}</td>
                  <td><Badge kind="warn">{h.type}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>
      )}
    </>
  );
}
