interface MagicEntry {
  bytes: number[];
  mime: string;
}

const MAGIC_TABLE: MagicEntry[] = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], mime: "application/zip" },
  { bytes: [0x50, 0x4b, 0x07, 0x08], mime: "application/zip" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], mime: "application/msword" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mime: "application/x-elf" },
  { bytes: [0x4d, 0x5a], mime: "application/x-dosexec" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x1f, 0x8b], mime: "application/gzip" },
  { bytes: [0x42, 0x5a, 0x68], mime: "application/x-bzip2" },
  { bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], mime: "application/x-7z-compressed" },
  { bytes: [0x52, 0x61, 0x72, 0x21], mime: "application/vnd.rar" },
];

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/zip",
  xlsx: "application/zip",
  pptx: "application/zip",
  doc: "application/msword",
  txt: "text/plain",
  csv: "text/plain",
  md: "text/plain",
  json: "application/json",
  xml: "text/xml",
};

export function detectMime(buf: Buffer): string | null {
  for (const { bytes, mime } of MAGIC_TABLE) {
    if (bytes.every((b, i) => buf[i] === b)) return mime;
  }
  return null;
}

export function mimeFromExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export type MimeCheckResult =
  | { ok: true }
  | { ok: false; error: "unsupported_media_type" | "encrypted_archive"; message: string };

export function checkMime(buf: Buffer, filename?: string): MimeCheckResult {
  const detected = detectMime(buf);
  const declared = filename ? mimeFromExtension(filename) : null;

  const unsupported = new Set(["application/x-elf", "application/x-dosexec"]);
  if (detected && unsupported.has(detected)) {
    return { ok: false, error: "unsupported_media_type", message: `Executable files are not accepted.` };
  }

  if (detected && declared && detected !== declared) {
    return {
      ok: false,
      error: "unsupported_media_type",
      message: `File extension does not match content (declared: ${declared}, detected: ${detected}).`,
    };
  }

  const supportedMimes = new Set([
    "application/pdf",
    "application/zip",
    "application/msword",
    "text/plain",
    "application/json",
    "text/xml",
  ]);
  if (detected && !supportedMimes.has(detected)) {
    return { ok: false, error: "unsupported_media_type", message: `Unsupported file type: ${detected}.` };
  }

  return { ok: true };
}
