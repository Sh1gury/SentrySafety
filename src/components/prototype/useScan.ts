'use client';

import { useCallback } from 'react';
import { SentrySafety } from '@/lib/sdk';
import { getDemoApiKey } from './apiKey';
import type { ScanRecord, ScanConfig, PiiHit } from './types';
import type { SanitizeSuccess, SanitizeConfig, PiiEntity } from '@/types/scan';

const client = new SentrySafety({ apiKey: getDemoApiKey(), baseUrl: '' });

export type ScanKind = 'text' | 'file';

export interface ScanInput {
  text: string;
  file: File | null;
}

function toApiConfig(config: ScanConfig): Partial<SanitizeConfig> {
  return {
    privacy: {
      mask_pii: config.privacy.mask_pii,
      entities_to_mask: config.privacy.entities_to_mask as PiiEntity[],
    },
    security: config.security,
    integrity: config.integrity,
  };
}

export function mapResponseToRecord(
  response: SanitizeSuccess,
  src: ScanInput,
): ScanRecord {
  const kind = src.file
    ? (src.file.name.split('.').pop() ?? 'file').toUpperCase()
    : 'text';

  const threatsBlocked = response.metadata.threats_blocked;
  const threats = Object.values(threatsBlocked).reduce((a, b) => a + b, 0);
  const threatList = (Object.entries(threatsBlocked) as [string, number][])
    .filter(([, count]) => count > 0)
    .map(([key]) => key);
  if (response.metadata.synthetic_spam_removed) {
    threatList.push('synthetic_spam');
  }

  const preview = src.file
    ? '[' + kind + '] ' + src.file.name
    : (response.clean_text.slice(0, 120) || '(empty)');

  const tokenMap = response.tokenMap ?? {};
  const piiHits: PiiHit[] = Object.entries(tokenMap).map(([token, value]) => ({
    token,
    value,
    type: token.split('_')[0],
  }));

  return {
    id: response.scanId,
    ts: Date.now(),
    kind,
    verdict: response.verdict,
    pii: response.metadata.pii_masked_count,
    threats,
    threatList,
    latency: response.latencyMs,
    bytes: src.file ? src.file.size : src.text.length,
    filename: src.file?.name,
    preview,
    clean_text: response.clean_text,
    tokenMap,
    piiHits,
    layer1: response.metadata.layer1,
    layer2: response.metadata.layer2,
    layer3: response.metadata.layer3,
  };
}

export interface UseScanResult {
  runScan: (text: string, kind: ScanKind, config: ScanConfig, file?: File | null) => Promise<ScanRecord>;
}

export function useScan(): UseScanResult {
  const runScan = useCallback(
    async (
      text: string,
      kind: ScanKind,
      config: ScanConfig,
      file: File | null = null,
    ): Promise<ScanRecord> => {
      const apiConfig = toApiConfig(config);
      const input: string | File = kind === 'file' && file ? file : text;
      const response = await client.sanitize(input, apiConfig);
      return mapResponseToRecord(response, { text, file: kind === 'file' ? file : null });
    },
    [],
  );

  return { runScan };
}
