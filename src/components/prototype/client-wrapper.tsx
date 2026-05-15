'use client';

import dynamic from 'next/dynamic';

const AppRoot = dynamic(() => import('./app-root'), { ssr: false });

export function ClientWrapper() {
  return <AppRoot />;
}
