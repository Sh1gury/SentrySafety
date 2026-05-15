export interface PdfSecurityReport {
  hasJavaScript: boolean;
  hasHiddenText: boolean;
  metadata: {
    author?: string;
    title?: string;
    producer?: string;
    creator?: string;
  };
}

const JS_KEYS = ["/JS", "/JavaScript", "/OpenAction", "/AA", "/Launch"];

const WHITE_FILL_PATTERNS = [
  /1\s+1\s+1\s+rg/g,
  /\b1\s+g\b/g,
  /1\s+1\s+1\s+sc\b/g,
  /1\s+1\s+1\s+scn\b/g,
];

const TEXT_OP_RE = /\b(?:Tj|TJ)\b|['"]/;

/**
 * Decode the simple PDF literal-string escapes we care about for metadata
 * fields. PDF literals can use \( and \) to escape parens, plus \\ for
 * backslash. This is intentionally conservative — Layer 1 is a firewall, not
 * a fully compliant parser.
 */
function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * Extract a single metadata field value (e.g. /Author (Anton Babienko)).
 * Returns undefined if the key is absent or the value is empty after trim.
 */
function readMetadataField(haystack: string, key: string): string | undefined {
  // Match /Key ( ... ) allowing for escaped parens inside.
  const re = new RegExp(
    `\\/${key}\\s*\\(((?:\\\\\\)|\\\\\\(|\\\\\\\\|[^()\\\\])*)\\)`,
  );
  const match = haystack.match(re);
  if (!match) return undefined;
  const decoded = decodePdfLiteral(match[1]);
  return decoded.length > 0 ? decoded : undefined;
}

function detectJavaScript(haystack: string): boolean {
  for (const key of JS_KEYS) {
    let idx = 0;
    while ((idx = haystack.indexOf(key, idx)) !== -1) {
      const after = haystack.charCodeAt(idx + key.length);
      // PDF names terminate on whitespace or delimiter characters. Reject
      // when the next byte is an alphanumeric continuation (e.g. /JSXFoo).
      const isAlnum =
        (after >= 0x30 && after <= 0x39) || // 0-9
        (after >= 0x41 && after <= 0x5a) || // A-Z
        (after >= 0x61 && after <= 0x7a); // a-z
      if (!Number.isNaN(after) && !isAlnum) {
        return true;
      }
      if (Number.isNaN(after)) {
        // End of buffer — still a match.
        return true;
      }
      idx += key.length;
    }
  }
  return false;
}

function detectHiddenText(haystack: string): boolean {
  for (const pattern of WHITE_FILL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(haystack)) !== null) {
      const start = m.index + m[0].length;
      const window = haystack.slice(start, start + 80);
      if (TEXT_OP_RE.test(window)) {
        return true;
      }
    }
  }
  return false;
}

export function scanPdfBytes(buf: Buffer): PdfSecurityReport {
  // latin1 is a 1:1 byte-to-char mapping — safe for pattern scanning over
  // raw PDF bytes regardless of internal stream encoding.
  const raw = buf.toString("latin1");

  return {
    hasJavaScript: detectJavaScript(raw),
    hasHiddenText: detectHiddenText(raw),
    metadata: {
      author: readMetadataField(raw, "Author"),
      title: readMetadataField(raw, "Title"),
      producer: readMetadataField(raw, "Producer"),
      creator: readMetadataField(raw, "Creator"),
    },
  };
}
