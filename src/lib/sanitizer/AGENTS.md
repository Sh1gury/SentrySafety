# Zone A — Sanitizer / Layer 1 (Anton)

You are inside `src/lib/sanitizer/**`. This is **Layer 1**: deterministic, local, no LLM.

Read first: repo root `AGENTS.md`, `docs/ARCHITECTURE.md` (Layer 1 section), `docs/SECURITY.md`.

## Goal

Take an incoming document, in any of these states:

- raw text
- base64-encoded file (PDF, DOCX, TXT, archive)

…and produce:

1. `clean_text` — text with PII tokenised and injection paragraphs stripped.
2. `tokenMap` — `{ "PERSON_1": "Богдана В.", ... }`.
3. A summary report matching `Layer1Report` + `ThreatsBlocked` + `pii_masked_count` from `@/types/scan`.

Layer 1 must **never** call out to the network. It runs offline. It runs even when `DEMO_MODE=true`.

## Suggested layout

```
src/lib/sanitizer/
  index.ts              // public entry: runLayer1(req: SanitizeRequest): Layer1Result
  extract/
    pdf.ts              // pdfjs-dist or similar — pull text from PDFs
    docx.ts             // unzip DOCX, walk XML, strip vbaProject.bin if present
    text.ts             // pass-through for text/plain
    detect.ts           // MIME magic-byte detection
  pii/
    regex.ts            // IBAN, card (with Luhn), email, phone, IP
    ner.ts              // wink-nlp wrapper for PERSON/ORG/LOCATION
    tokenize.ts         // stable in-document tokens [PERSON_1], [CARD_1], ...
  security/
    zipBomb.ts          // streaming decompress + ratio guard
    macros.ts           // detect + strip Office macros
    signatures.ts       // static list of injection regexes/keywords
  index.test.ts         // (optional) inline tests for the regex tables
```

## Local rules

- **No outbound HTTP from this module.** If you need a model, it belongs in Layer 2 (`src/lib/ai/**`).
- **Zero dependence on Next.js APIs.** This module must be runnable from a plain Node script (the simulator may import its types).
- **MIME validation comes before any decode.** A `.pdf` whose magic bytes say `.exe` returns `unsupported_media_type` immediately — do not try to parse.
- **Zip-bomb guard before extraction.** Stream-read the archive, track decompressed bytes, abort when ratio exceeds `config.security.max_decompression_ratio`.
- **Token stability rule:** within one document, the same value gets the same token. Across documents, tokens are randomised. Do not leak token reuse across requests.
- **Tokenisation order matters:** apply regex PII first (deterministic), then NER (probabilistic) on the remaining text, so NER never has a chance to mislabel an IBAN as a name.
- **Signature list is just a list.** Keep it as plain TypeScript constants in `security/signatures.ts`. Anyone on the team should be able to add a line without a build step.

## Public surface

Export from `src/lib/sanitizer/index.ts`:

```ts
export interface Layer1Result {
  clean_text: string;
  tokenMap: Record<string, string>;
  report: Layer1Report;
  pii_masked_count: number;
  threats_blocked: ThreatsBlocked;
  hard_block?: { error: SanitizeErrorCode; message: string };
}

export function runLayer1(req: SanitizeRequest): Promise<Layer1Result>;
```

`hard_block` is set for unrecoverable file-level threats (zip bomb, MIME mismatch, encrypted archive). When present, the route returns an error response and never invokes Layer 2.

## Do not import

- Any React, any Next.js client-only API, any Supabase.
- `src/lib/ai/**` — Layer 1 never depends on Layer 2 or the LLM.
