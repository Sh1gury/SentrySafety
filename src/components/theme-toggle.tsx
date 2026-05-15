'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ss-theme';

function getThemeSnapshot(): 'dark' | 'light' {
  const stored = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
  const attr = document.documentElement.dataset.theme as 'dark' | 'light' | undefined;
  return stored || attr || 'dark';
}

function subscribeTheme(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

export function ThemeToggle({ variant = 'dashboard' }: { variant?: 'dashboard' | 'landing' }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'dark');

  function toggle() {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event('storage'));
  }

  const label = theme === 'dark' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      className={variant === 'landing' ? 'lp-theme-toggle-btn' : 'theme-toggle-btn'}
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} theme`}
    >
      {label}
    </button>
  );
}
