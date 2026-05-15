export type Verdict = "allow" | "warn" | "block";

export type Severity = "low" | "medium" | "high";

export type PiiEntity =
  | "PERSON"
  | "ORGANIZATION"
  | "LOCATION"
  | "EMAIL"
  | "PHONE"
  | "CREDIT_CARD"
  | "IBAN"
  | "IP";

export type ThreatType =
  | "prompt_injection"
  | "hidden_text"
  | "zero_width"
  | "role_escalation"
  | "exfiltration_request"
  | "data_poisoning"
  | "malicious_markup"
  | "zip_bomb"
  | "mime_mismatch"
  | "encrypted_archive"
  | "macro_present"
  | "synthetic_spam"
  | "unknown";

export type Layer2AgentName = "semantic" | "logic";

export interface SanitizeConfig {
  privacy: {
    mask_pii: boolean;
    entities_to_mask: PiiEntity[];
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

export interface SanitizeRequest {
  filename?: string;
  content?: string;
  file_base64?: string;
  metadata?: Record<string, string>;
  config?: Partial<SanitizeConfig>;
}

export interface ThreatsBlocked {
  zip_bombs: number;
  mime_mismatch: number;
  macros_stripped: number;
  prompt_injections: number;
}

export interface Layer1Report {
  verdict: Verdict;
  removed_paragraphs: number;
}

export interface AgentVerdict {
  verdict: Verdict;
  score: number;
}

export interface Layer2Report {
  verdict: Verdict;
  score: number;
  demoMode: boolean;
  agents: Record<Layer2AgentName, AgentVerdict>;
}

export interface Layer3Report {
  enabled: boolean;
  synthetic_paragraphs_removed?: number;
  confidence?: number;
}

export interface SanitizeMetadata {
  pii_masked_count: number;
  threats_blocked: ThreatsBlocked;
  synthetic_spam_removed: boolean;
  layer1: Layer1Report;
  layer2: Layer2Report;
  layer3: Layer3Report;
}

export interface SanitizeSuccess {
  status: "success";
  scanId: string;
  verdict: Verdict;
  clean_text: string;
  tokenMap?: Record<string, string>;
  metadata: SanitizeMetadata;
  latencyMs: number;
}

export type SanitizeErrorCode =
  | "invalid_payload"
  | "encrypted_archive"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "engine_error"
  | "model_unavailable";

export interface SanitizeError {
  status: "error";
  error: SanitizeErrorCode;
  message: string;
}

export type SanitizeResponse = SanitizeSuccess | SanitizeError;
