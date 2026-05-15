export type Verdict = 'allow' | 'warn' | 'block';

export interface PiiHit {
  token: string;
  value: string;
  type: string;
}

export interface ScanRecord {
  id: string;
  ts: number;
  kind: string;
  verdict: Verdict;
  pii: number;
  threats: number;
  threatList: string[];
  latency: number;
  bytes: number;
  filename?: string;
  preview: string;
  tokenMap: Record<string, string>;
  piiHits?: PiiHit[];
  layer1: { verdict: Verdict; removed_paragraphs: number };
  layer2: {
    verdict: Verdict;
    score: number;
    demoMode: boolean;
    agents: {
      semantic: { verdict: Verdict; score: number };
      logic: { verdict: Verdict; score: number };
    };
  };
  layer3: {
    enabled: boolean;
    synthetic_paragraphs_removed?: number;
    confidence?: number;
  };
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

export type Page = 'login' | 'register' | 'scan' | 'logs' | 'dashboard' | 'settings' | 'plan';
