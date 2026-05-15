function isSafeEntryName(name: string): boolean {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.startsWith("/") || name.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(name)) return false;
  // Normalize slashes; reject backslashes outright (DOCX uses forward slashes)
  if (name.includes("\\")) return false;
  return true;
}

export async function extractDocxText(buf: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(buf);

  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found — not a valid DOCX");

  if (!isSafeEntryName(entry.entryName)) {
    throw new Error("Unsafe ZIP entry path detected");
  }

  const xml: string = entry.getData().toString("utf-8");
  // Strip all XML tags, collapse whitespace
  return xml
    .replace(/<w:p\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripDocxMacros(buf: Buffer): { buf: Buffer; stripped: number } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(buf);
  let stripped = 0;

  const macroPaths = [
    "word/vbaProject.bin",
    "xl/vbaProject.bin",
    "ppt/vbaProject.bin",
  ];

  for (const entry of zip.getEntries()) {
    if (!isSafeEntryName(entry.entryName)) continue;
    if (macroPaths.includes(entry.entryName) || entry.entryName.endsWith("/vbaProject.bin")) {
      zip.deleteFile(entry.entryName);
      stripped++;
    }
  }

  return { buf: stripped > 0 ? zip.toBuffer() : buf, stripped };
}

export function isEncryptedArchive(buf: Buffer): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  try {
    const zip = new AdmZip(buf);
    for (const entry of zip.getEntries()) {
      if (!isSafeEntryName(entry.entryName)) continue;
      const flags = entry.header?.flags;
      if (typeof flags === "number" && (flags & 1) === 1) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function checkZipBomb(buf: Buffer, maxRatio: number): { isBomb: boolean; ratio: number } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  try {
    const zip = new AdmZip(buf);
    let uncompressedTotal = 0;
    for (const entry of zip.getEntries()) {
      if (!isSafeEntryName(entry.entryName)) {
        return { isBomb: true, ratio: Infinity };
      }
      uncompressedTotal += entry.header.size;
    }
    const ratio = buf.length > 0 ? uncompressedTotal / buf.length : 1;
    return { isBomb: ratio > maxRatio, ratio };
  } catch {
    return { isBomb: false, ratio: 1 };
  }
}
