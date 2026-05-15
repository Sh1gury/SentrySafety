export interface ChunkOptions {
  /** Hard cap on characters per chunk. */
  maxChars: number;
  /** Overlap between consecutive chunks; protects boundary-straddling injections. */
  overlap: number;
  /** Hard cap on number of chunks; longer docs get truncated. */
  maxChunks: number;
}

const DEFAULTS: ChunkOptions = {
  maxChars: 5500,
  overlap: 400,
  maxChunks: 4,
};

/**
 * Split text into overlapping chunks so a single LLM call can cover the
 * whole document. Prefers paragraph boundaries near the chunk edge so that
 * the model receives semantically coherent fragments.
 */
export function chunkText(text: string, opts: Partial<ChunkOptions> = {}): string[] {
  const { maxChars, overlap, maxChunks } = { ...DEFAULTS, ...opts };

  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length && chunks.length < maxChunks) {
    let end = Math.min(pos + maxChars, text.length);

    // Try to land on a paragraph boundary, but only if we keep at least
    // half the chunk filled — otherwise we'd waste API calls.
    if (end < text.length) {
      const minViableEnd = pos + Math.floor(maxChars * 0.5);
      const lastBreak = text.lastIndexOf("\n\n", end);
      if (lastBreak > minViableEnd) end = lastBreak;
    }

    chunks.push(text.slice(pos, end));

    if (end >= text.length) break;
    pos = end - overlap;
  }

  return chunks;
}
