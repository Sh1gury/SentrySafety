import { scanPdfBytes, type PdfSecurityReport } from "./pdfSecurity";

export async function extractPdfText(
  buf: Buffer,
): Promise<{ text: string; security: PdfSecurityReport }> {
  const { PDFParse } = await import("pdf-parse");
  const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  const baseText = typeof result === "string" ? result : String(result);

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
