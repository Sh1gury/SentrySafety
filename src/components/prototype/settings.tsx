'use client';

import { useState } from 'react';
import { PageHeader, Toggle, classNames } from './shared';
import type { ScanConfig } from './types';

const FAKE_API_KEY = 'sk-sentry-a7f2d3e1b5c9084f2a3d6e1b';
const API_ENDPOINT = 'https://api.sentrysafety.io/v1/scan';

export function SettingsPage({
  config,
  setConfig,
  userEmail,
}: {
  config: ScanConfig;
  setConfig: (c: ScanConfig) => void;
  userEmail: string;
}) {
  const [keyVisible, setKeyVisible] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  function savePolicy() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Manage your account and default scan policy."
      />
      <div className="settings-layout">

        {/* Account */}
        <div className="card">
          <div className="card-title">Account</div>
          <div className="settings-account-row">
            <div className="settings-avatar-lg">{initial}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{userEmail}</div>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>Starter Plan</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="label">Display name</label>
            <input
              className="input"
              defaultValue={userEmail.split('@')[0]}
              style={{ maxWidth: 320 }}
            />
          </div>
        </div>

        {/* API Access */}
        <div className="card">
          <div className="card-title">API Access</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Endpoint</label>
              <div className="api-key-row">
                <div className="api-key-field" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {API_ENDPOINT}
                </div>
                <button
                  className={classNames('btn btn-sm', copied === 'endpoint' && 'btn-primary')}
                  onClick={() => copy(API_ENDPOINT, 'endpoint')}
                >
                  {copied === 'endpoint' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">API Key</label>
              <div className="api-key-row">
                <div className="api-key-field">
                  {keyVisible ? FAKE_API_KEY : FAKE_API_KEY.slice(0, 10) + '•'.repeat(16)}
                </div>
                <button className="btn btn-sm" onClick={() => setKeyVisible(v => !v)}>
                  {keyVisible ? 'Hide' : 'Reveal'}
                </button>
                <button
                  className={classNames('btn btn-sm', copied === 'key' && 'btn-primary')}
                  onClick={() => copy(FAKE_API_KEY, 'key')}
                >
                  {copied === 'key' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Default Scan Policy */}
        <div className="card">
          <div className="card-title">Default scan policy</div>
          <div className="section-label" style={{ marginTop: 0 }}>Privacy — Layer 1</div>
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-label">Mask PII</div>
              <div className="toggle-desc">Replace names, IBANs, emails, and phones with reversible tokens.</div>
            </div>
            <Toggle
              on={config.privacy.mask_pii}
              onChange={v => setConfig({ ...config, privacy: { ...config.privacy, mask_pii: v } })}
            />
          </div>

          <div className="section-label">Security — Layer 1</div>
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-label">Block prompt injections</div>
              <div className="toggle-desc">Reject documents containing known jailbreak or instruction-override patterns.</div>
            </div>
            <Toggle
              on={config.security.block_injections}
              onChange={v => setConfig({ ...config, security: { ...config.security, block_injections: v } })}
            />
          </div>
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-label">Strip DOCX macros</div>
              <div className="toggle-desc">Remove VBA macros from Word documents before passing content downstream.</div>
            </div>
            <Toggle
              on={config.security.strip_macros}
              onChange={v => setConfig({ ...config, security: { ...config.security, strip_macros: v } })}
            />
          </div>

          <div className="section-label">Integrity — Layer 3</div>
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="toggle-label">Detect AI-generated content</div>
              <div className="toggle-desc">Flag synthetic text to prevent vector-store autophagy. Adds ~200 ms latency.</div>
            </div>
            <Toggle
              on={config.integrity.check_autophagy}
              onChange={v => setConfig({ ...config, integrity: { check_autophagy: v } })}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={savePolicy}>
              {saved ? '✓ Saved' : 'Save changes'}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Policy updated for all new scans.</span>}
          </div>
        </div>

      </div>
    </div>
  );
}
