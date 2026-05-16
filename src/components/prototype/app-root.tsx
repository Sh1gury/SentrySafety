'use client';

import { useState } from 'react';
import { TopNav } from './shared';
import { ScanPage } from './scan';
import { LogsPage } from './logs';
import { DashboardPage } from './dashboard';
import { SettingsPage } from './settings';
import { PlanPage } from './plan';
import { logout } from '@/actions/auth';
import { useConfig } from './useConfig';
import type { ScanRecord, Page } from './types';

export default function AppRoot({ initialUser }: { initialUser: string }) {
  const [page, setPage] = useState<Page>('scan');
  const { config, setConfig, displayName, setDisplayName, save, saving, savedAt } = useConfig();
  const [scans, setScans] = useState<ScanRecord[]>([]);

  async function handleLogout() {
    await logout();
  }

  function addScan(s: ScanRecord) {
    setScans(prev => [s, ...prev]);
  }

  return (
    <div className="app-shell">
      <TopNav
        page={page}
        onNav={setPage}
        userEmail={initialUser}
        displayName={displayName}
        onLogout={handleLogout}
      />
      {page === 'scan' && (
        <ScanPage config={config} setConfig={setConfig} addScan={addScan} />
      )}
      {page === 'logs' && <LogsPage scans={scans} addScan={addScan} config={config} />}
      {page === 'dashboard' && <DashboardPage scans={scans} />}
      {page === 'settings' && (
        <SettingsPage
          config={config}
          setConfig={setConfig}
          userEmail={initialUser}
          displayName={displayName}
          setDisplayName={setDisplayName}
          save={save}
          saving={saving}
          savedAt={savedAt}
        />
      )}
      {page === 'plan' && <PlanPage />}
    </div>
  );
}
