'use client';

import { useState, useRef, useEffect } from 'react';
import type { Verdict, Page } from './types';

// ---------- Helpers ----------
export function classNames(...args: (string | boolean | undefined | null)[]): string {
  return args.filter(Boolean).join(' ');
}

export function formatRelTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------- Logo ----------
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className={size === 'lg' ? 'auth-logo' : 'nav-logo'}>
      <span className="glyph">⬡</span>
      <span className="word">SENTRY SAFETY</span>
    </div>
  );
}

// ---------- User Menu ----------
function UserMenu({ userEmail, displayName, onNav, onLogout }: {
  userEmail: string;
  displayName?: string | null;
  onNav: (p: Page) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shownName = displayName || userEmail.split('@')[0];
  const initial = (shownName || userEmail).charAt(0).toUpperCase();

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function go(p: Page) { onNav(p); setOpen(false); }

  return (
    <div className="user-menu-wrap" ref={ref}>
      <button
        className={classNames('avatar-btn', open && 'open')}
        onClick={() => setOpen(v => !v)}
        aria-label="User menu"
      >
        {initial}
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-menu-avatar-lg">{initial}</div>
            <div className="user-menu-info">
              <div className="user-menu-email">{shownName}</div>
              <div className="user-menu-plan">
                <span className="plan-dot"></span>
                Starter
              </div>
            </div>
          </div>
          <div className="user-menu-section">
            <button className="user-menu-item" onClick={() => go('settings')}>
              <span>Settings</span>
              <span className="menu-item-right">▸</span>
            </button>
            <button className="user-menu-item" onClick={() => go('plan')}>
              <span>Plan</span>
              <span className="menu-item-right">▸</span>
            </button>
          </div>
          <div className="user-menu-section">
            <div className="user-menu-item disabled">
              <span>Language</span>
              <span className="menu-item-right">EN ▸</span>
            </div>
          </div>
          <div className="user-menu-section">
            <button className="user-menu-item danger" onClick={() => { onLogout(); setOpen(false); }}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Top Nav ----------
export function TopNav({ page, onNav, userEmail, displayName, onLogout }: {
  page: Page;
  onNav: (p: Page) => void;
  userEmail: string;
  displayName?: string | null;
  onLogout: () => void;
}) {
  const NAV_LINKS: { id: Page; label: string }[] = [
    { id: 'scan', label: 'Scan' },
    { id: 'logs', label: 'Logs' },
    { id: 'dashboard', label: 'Dashboard' },
  ];
  const isMainPage = NAV_LINKS.some(l => l.id === page);
  return (
    <nav className="topnav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo />
        <span className="badge badge-neutral" style={{ marginLeft: 4 }}>v1.4.2</span>
      </div>
      <div className="nav-links">
        {NAV_LINKS.map(l => (
          <button
            key={l.id}
            className={classNames('nav-link', isMainPage && page === l.id && 'active')}
            onClick={() => onNav(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="nav-right">
        <UserMenu userEmail={userEmail} displayName={displayName} onNav={onNav} onLogout={onLogout} />
      </div>
    </nav>
  );
}

// ---------- Toggle ----------
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={classNames('toggle', on && 'on')}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    />
  );
}

// ---------- Badge ----------
export function Badge({ kind, dot, children }: {
  kind?: 'allow' | 'warn' | 'block' | 'mock' | 'neutral';
  dot?: boolean;
  children: React.ReactNode;
}) {
  const cls = {
    allow: 'badge-allow',
    warn: 'badge-warn',
    block: 'badge-block',
    mock: 'badge-mock',
    neutral: 'badge-neutral',
  }[kind ?? 'neutral'] ?? 'badge-neutral';
  return (
    <span className={classNames('badge', cls, dot && 'dot')}>
      {children}
    </span>
  );
}

// ---------- Pill ----------
export function Pill({ on, onClick, children }: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={classNames('pill', on && 'on')} onClick={onClick}>
      <span className="check">✓</span>
      <span>{children}</span>
    </button>
  );
}

// ---------- Verdict Badge ----------
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge kind={verdict} dot>{verdict}</Badge>;
}

// ---------- Collapsible ----------
export function Collapsible({ title, defaultOpen = false, children, right }: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={classNames('collapsible', open && 'open')}>
      <div className="collapsible-head" onClick={() => setOpen(!open)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chevron">▸</span>
          {title}
        </span>
        {right}
      </div>
      <div className="collapsible-body">{children}</div>
    </div>
  );
}

// ---------- Page Header ----------
export function PageHeader({ eyebrow, title, subtitle, right }: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <div className="page-title">{title}</div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export const PII_ENTITIES = [
  'PERSON', 'EMAIL', 'PHONE', 'IBAN', 'CREDIT_CARD', 'IP', 'LOCATION', 'ORGANIZATION',
];

