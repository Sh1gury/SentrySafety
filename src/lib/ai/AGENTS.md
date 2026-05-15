# Zone A — AI Core / Layer 2 + 3 (Anton)

You are inside `src/lib/ai/**`. This is **Layer 2** (LLM ensemble) and, optionally, **Layer 3** (autophagy check). Both use the same Groq API key.

Read first: repo root `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.

## Important: Layer 2 only sees Layer-1-sanitised text

By the time this module runs, PII has been replaced by tokens (`[PERSON_1]`, `[IBAN_1]`, etc.). That is the product's main selling point — the LLM provider never receives raw PII. **Do not undo this**: do not import the original text or the `tokenMap` into any prompts.

## Layer 2 — Groq + Llama

- Provider: **Groq API** (`GROQ_API_KEY`).
- Default model: **`llama-3.3-70b-versatile`** — fast (~200-400 ms), strong reasoning, supports JSON mode.
- JSON mode: `response_format: { type: "json_object" }`. Groq does not support OpenAI-style strict `json_schema`; **validate the parsed object against our schema on our side** (lightweight type-guard in `src/lib/ai/validateLayer2.ts`).
- Force-prompt JSON structure: the sandwich header must also explicitly say "respond with valid JSON matching this schema: { ... }" to improve reliability.

All Groq calls go through `groqClient.ts`. No raw `fetch("https://api.groq.com/...")` anywhere else in the codebase.

## Local rules

- Every prompt builder lives in `prompts/` and **must** wrap user content in `<document>...</document>`. See `docs/ARCHITECTURE.md` → Sandwich prompting.
- If the response fails JSON parsing or schema validation: retry once; if it fails again, return `engine_error`. Do not swallow invalid responses.
- DEMO_MODE shim (`demoMode.ts`) exports `mockLayer2(cleanText): Layer2Report`. It must:
  - Pattern-match a small list of injection markers (e.g. "ignore previous", "you are now", "developer mode").
  - Vary the verdict with input so demos do not look static.
  - Set `demoMode: true` on the report.
  - Pad latency to ~400 ms so the demo feels real.

## Layer 3 (opt-in)

Lives in `src/lib/ai/integrity/`. Runs only when the request opted in via `config.integrity.check_autophagy === true`.

- Same Groq API key, lighter model (`llama-3.1-8b-instant` is fine for entropy scoring).
- Input: Layer-1-sanitised text, paragraph-by-paragraph.
- Output: `Layer3Report` with `synthetic_paragraphs_removed` and `confidence`.
- If `GROQ_API_KEY` is missing and Layer 3 was requested → return `Layer3Report { enabled: true, synthetic_paragraphs_removed: 0, confidence: 0 }` and log a warning. **Do not throw** — Layer 3 failure must not fail the whole sanitize call.

## Public surface

Export from `src/lib/ai/index.ts`:

```ts
export async function runLayer2(
  cleanText: string,
  opts: { demoMode: boolean }
): Promise<Layer2Report>;

export async function runLayer3(
  cleanText: string,
  opts: { enabled: boolean }
): Promise<Layer3Report>;
```

## Suggested layout

```
src/lib/ai/
  index.ts              // public entry: runLayer2, runLayer3
  groqClient.ts         // single Groq client, env-driven
  validateLayer2.ts     // schema type-guard for Groq JSON responses
  fusion.ts             // combine 2-agent verdicts into one Layer2Report
  demoMode.ts           // mock Layer 2 shim
  agents/
    semantic.ts
    logic.ts
  prompts/
    sandwich.ts         // shared header/footer builder
    semantic.ts
    logic.ts
  integrity/
    runLayer3.ts
```

## Do not import

- Any React, any Next.js client-only API, any Supabase.
- `src/lib/sanitizer/**` — Layer 2 is downstream. The route composes them, not us.
