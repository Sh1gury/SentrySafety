'use client';

import { useState } from 'react';
import { TopNav, seedScans } from './shared';
import { AuthPage } from './auth';
import { ScanPage } from './scan';
import { LogsPage } from './logs';
import { DashboardPage } from './dashboard';
import { SettingsPage } from './settings';
import { PlanPage } from './plan';
import type { ScanRecord, ScanConfig, Page } from './types';

const DEFAULT_CONFIG: ScanConfig = {
  privacy: {
    mask_pii: true,
    entities_to_mask: ['PERSON', 'EMAIL', 'PHONE', 'IBAN', 'CREDIT_CARD'],
  },
  security: {
    block_injections: true,
    max_decompression_ratio: 100,
    strip_macros: true,
  },
  integrity: {
    check_autophagy: false,
  },
};

export default function AppRoot() {
  const [page, setPage] = useState<Page>('login');
  const [user, setUser] = useState<string | null>(null);
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [scans, setScans] = useState<ScanRecord[]>(() => seedScans());

  function handleAuth(email: string) {
    setUser(email);
    setPage('scan');
  }

  function logout() {
    setUser(null);
    setPage('login');
  }

  function addScan(s: ScanRecord) {
    setScans(prev => [s, ...prev]);
  }

  if (!user) {
    return (
      <AuthPage
        mode={page === 'register' ? 'register' : 'login'}
        onSwitch={setPage}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopNav page={page} onNav={setPage} userEmail={user} onLogout={logout} />
      {page === 'scan' && (
        <ScanPage config={config} setConfig={setConfig} scans={scans} addScan={addScan} />
      )}
      {page === 'logs' && <LogsPage scans={scans} />}
      {page === 'dashboard' && <DashboardPage scans={scans} />}
      {page === 'settings' && (
        <SettingsPage config={config} setConfig={setConfig} userEmail={user} />
      )}
      {page === 'plan' && <PlanPage />}
    </div>
  );
}
