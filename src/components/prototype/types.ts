import type { Layer1Report, Layer2Report, Layer3Report } from '@/types/scan';

export type { Verdict } from '@/types/scan';
export type { Layer1Report, Layer2Report, Layer3Report };

export interface PiiHit {
  token: string;
  value: string;
  type: string;
}

export interface ScanRecord {
  id: string;
  ts: number;
  kind: string;
  verdict: import('@/types/scan').Verdict;
  pii: number;
  threats: number;
  threatList: string[];
  latency: number;
  bytes: number;
  filename?: string;
  preview: string;
  clean_text: string;
  tokenMap: Record<string, string>;
  piiHits?: PiiHit[];
  layer1: Layer1Report;
  layer2: Layer2Report;
  layer3: Layer3Report;
}

export interface ScanConfig {
  privacy: {
    mask_pii: boolean;
    entities_to_mask: string[];
  };
  security: {
    block_injections: boolean;
    max_decompression_ratio: number;
    strip_macros: boolean;
  };
  integrity: {
    check_autophagy: boolean;
  };
}

export type Page = 'scan' | 'logs' | 'dashboard' | 'settings' | 'plan';
