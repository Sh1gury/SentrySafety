import { scanPdfBytes, type PdfSecurityReport } from "./pdfSecurity";

export async function extractPdfText(
  buf: Buffer,
): Promise<{ text: string; security: PdfSecurityReport }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buf);
  const baseText = (data.text as string) ?? "";

  const security = scanPdfBytes(buf);

  // Surface metadata into the text stream so downstream PII tokenization
  // catches names/emails authors leave in /Author, /Title, etc.
  const metaParts: string[] = [];
  const { author, title, producer, creator } = security.metadata;
  if (author) metaParts.push(`Author: ${author}`);
  if (title) metaParts.push(`Title: ${title}`);
  if (producer) metaParts.push(`Producer: ${producer}`);
  if (creator) metaParts.push(`Creator: ${creator}`);

  const text =
    metaParts.length > 0
      ? `[PDF METADATA] ${metaParts.join(" | ")}\n${baseText}`
      : baseText;

  return { text, security };
}
