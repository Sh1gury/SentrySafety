'use client';

import { useState } from 'react';
import { TopNav } from './shared';
import { ScanPage } from './scan';
import { LogsPage } from './logs';
import { DashboardPage } from './dashboard';
import { SettingsPage } from './settings';
import { PlanPage } from './plan';
import { logout } from '@/actions/auth';
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

export default function AppRoot({ initialUser }: { initialUser: string }) {
  const [page, setPage] = useState<Page>('scan');
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [scans, setScans] = useState<ScanRecord[]>([]);

  async function handleLogout() {
    await logout();
  }

  function addScan(s: ScanRecord) {
    setScans(prev => [s, ...prev]);
  }

  return (
    <div className="app-shell">
      <TopNav page={page} onNav={setPage} userEmail={initialUser} onLogout={handleLogout} />
      {page === 'scan' && (
        <ScanPage config={config} setConfig={setConfig} scans={scans} addScan={addScan} />
      )}
      {page === 'logs' && <LogsPage scans={scans} />}
      {page === 'dashboard' && <DashboardPage scans={scans} />}
      {page === 'settings' && (
        <SettingsPage config={config} setConfig={setConfig} userEmail={initialUser} />
      )}
      {page === 'plan' && <PlanPage />}
    </div>
  );
}
