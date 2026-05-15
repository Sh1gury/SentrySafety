import type { SanitizeRequest, SanitizeConfig, Layer1Report, ThreatsBlocked, SanitizeErrorCode } from "@/types/scan";
import { containsInjection } from "./security/signatures";
import { findRegexPii } from "./pii/regex";
import { findNerPii } from "./pii/ner";
import { tokenize } from "./pii/tokenize";
import { checkMime, detectMime } from "./extract/detect";
import { extractPlainText } from "./extract/text";
import { extractPdfText } from "./extract/pdf";
import { extractDocxText, stripDocxMacros, checkZipBomb, isEncryptedArchive } from "./extract/docx";
import { extractHtmlText } from "./extract/html";

export interface Layer1Result {
  clean_text: string;
  tokenMap: Record<string, string>;
  report: Layer1Report;
  pii_masked_count: number;
  threats_blocked: ThreatsBlocked;
  hard_block?: { error: SanitizeErrorCode; message: string };
}

const DEFAULT_CONFIG: SanitizeConfig = {
  privacy: {
    mask_pii: true,
    entities_to_mask: ["PERSON", "CREDIT_CARD", "PHONE", "EMAIL", "IBAN", "IP"],
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

function mergeConfig(partial?: Partial<SanitizeConfig>): SanitizeConfig {
  if (!partial) return DEFAULT_CONFIG;
  return {
    privacy: { ...DEFAULT_CONFIG.privacy, ...partial.privacy },
    security: { ...DEFAULT_CONFIG.security, ...partial.security },
    integrity: { ...DEFAULT_CONFIG.integrity, ...partial.integrity },
  };
}

const MAX_TEXT_BYTES = 1_048_576; // 1 MB

export async function runLayer1(req: SanitizeRequest): Promise<Layer1Result> {
  const cfg = mergeConfig(req.config);
  const threats: ThreatsBlocked = {
    zip_bombs: 0,
    mime_mismatch: 0,
    macros_stripped: 0,
    prompt_injections: 0,
  };

  // ── 1. Decode and extract text ────────────────────────────────────────────

  let rawText: string;

  if (req.file_base64) {
    const buf = Buffer.from(req.file_base64, "base64");

    // MIME / magic-byte check
    const mimeResult = checkMime(buf, req.filename);
    if (!mimeResult.ok) {
      if (mimeResult.error === "unsupported_media_type") threats.mime_mismatch++;
      return makeHardBlock(threats, mimeResult.error, mimeResult.message);
    }

    const detectedMime = detectMime(buf);

    if (detectedMime === "application/zip") {
      // Encrypted-archive guard — refuse to even attempt decryption.
      if (isEncryptedArchive(buf)) {
        return makeHardBlock(
          threats,
          "encrypted_archive",
          "Password-protected archive — refusing to attempt decryption.",
        );
      }

      // Zip-bomb guard before any decompression
      const { isBomb } = checkZipBomb(buf, cfg.security.max_decompression_ratio);
      if (isBomb) {
        threats.zip_bombs++;
        return makeHardBlock(threats, "payload_too_large", "Zip bomb detected: decompression ratio exceeds limit.");
      }

      // Macro stripping (modifies buffer in-place for this request only)
      let workBuf: Buffer = buf as Buffer;
      if (cfg.security.strip_macros) {
        const { buf: clean, stripped } = stripDocxMacros(buf);
        workBuf = clean as Buffer;
        threats.macros_stripped = stripped;
      }

      rawText = await extractDocxText(workBuf);
    } else if (detectedMime === "application/pdf") {
      const { text, security } = await extractPdfText(buf);
      if (security.hasJavaScript) {
        return makeHardBlock(
          threats,
          "unsupported_media_type",
          "PDF contains executable JavaScript actions.",
        );
      }
      if (security.hasHiddenText) {
        // No scanId in scope at this layer; route logs surface it.
        console.warn("[layer1] PDF hidden-text detected for scanId N/A");
      }
      rawText = text;
    } else if (
      req.filename?.toLowerCase().endsWith(".html") ||
      req.filename?.toLowerCase().endsWith(".htm")
    ) {
      rawText = extractHtmlText(buf);
    } else {
      rawText = extractPlainText(buf);
    }
  } else {
    rawText = req.content ?? "";
  }

  // Size guard after extraction
  if (Buffer.byteLength(rawText) > MAX_TEXT_BYTES) {
    return makeHardBlock(threats, "payload_too_large", "Document exceeds 1 MB after text extraction.");
  }

  // ── 2. Injection signature detection (paragraph-level removal) ───────────

  let workText = rawText;
  let removedParagraphs = 0;

  if (cfg.security.block_injections) {
    const paragraphs = rawText.split(/\n{2,}/);
    const safe: string[] = [];
    for (const para of paragraphs) {
      if (containsInjection(para)) {
        threats.prompt_injections++;
        removedParagraphs++;
      } else {
        safe.push(para);
      }
    }
    workText = safe.join("\n\n");
  }

  // ── 3. PII masking ────────────────────────────────────────────────────────

  let piiCount = 0;
  const tokenMap: Record<string, string> = {};

  if (cfg.privacy.mask_pii && cfg.privacy.entities_to_mask.length > 0) {
    const allowed = new Set(cfg.privacy.entities_to_mask);
    const counters: Record<string, number> = {};

    // Pass 1: regex PII (deterministic, runs first)
    const regexMatches = findRegexPii(workText).filter((m) => allowed.has(m.type));
    const pass1 = tokenize(workText, regexMatches, counters);
    Object.assign(counters, extractCounters(pass1.tokenMap));
    Object.assign(tokenMap, pass1.tokenMap);

    // Pass 2: NER on already-masked text (so NER never sees raw IBAN/card digits)
    const nerMatches = findNerPii(pass1.maskedText).filter((m) => allowed.has(m.type));
    const pass2 = tokenize(pass1.maskedText, nerMatches, counters);
    Object.assign(tokenMap, pass2.tokenMap);

    workText = pass2.maskedText;
    piiCount = pass1.count + pass2.count;
  }

  // ── 4. Build result ───────────────────────────────────────────────────────

  const verdict: Layer1Report["verdict"] =
    threats.prompt_injections > 0 ? "warn" : "allow";

  return {
    clean_text: workText,
    tokenMap,
    report: { verdict, removed_paragraphs: removedParagraphs },
    pii_masked_count: piiCount,
    threats_blocked: threats,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeHardBlock(
  threats: ThreatsBlocked,
  error: SanitizeErrorCode,
  message: string
): Layer1Result {
  return {
    clean_text: "",
    tokenMap: {},
    report: { verdict: "block", removed_paragraphs: 0 },
    pii_masked_count: 0,
    threats_blocked: threats,
    hard_block: { error, message },
  };
}

function extractCounters(tokenMap: Record<string, string>): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const key of Object.keys(tokenMap)) {
    const parts = key.split("_");
    if (parts.length >= 2) {
      const n = Number(parts[parts.length - 1]);
      const prefix = parts.slice(0, -1).join("_");
      if (!isNaN(n)) counters[prefix] = Math.max(counters[prefix] ?? 0, n);
    }
  }
  return counters;
}
