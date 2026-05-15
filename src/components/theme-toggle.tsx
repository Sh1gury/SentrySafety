'use client';

import { useSyncExternalStore, useEffect } from 'react';

const STORAGE_KEY = 'ss-theme';

function subscribe(cb: () => void): () => void {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function getSnapshot(): 'dark' | 'light' {
  return (localStorage.getItem(STORAGE_KEY) as 'dark' | 'light') || 'dark';
}

function getServerSnapshot(): 'dark' | 'light' {
  return 'dark';
}

export function ThemeToggle({ variant = 'dashboard' }: { variant?: 'dashboard' | 'landing' }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep data-theme in sync after hydration (fallback if <head> script didn't run)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggle() {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    // storage events don't fire in the same tab — dispatch manually
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }

  return (
    <button
      type="button"
      suppressHydrationWarning
      className={variant === 'landing' ? 'lp-theme-toggle-btn' : 'theme-toggle-btn'}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
