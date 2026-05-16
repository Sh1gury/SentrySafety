# Zone A — AI Core / Layer 2 + 3 (Anton)

You are inside `src/lib/ai/**`. This is **Layer 2** (Denis ML classifier) and, optionally, **Layer 3** (autophagy check).

Read first: repo root `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.

## Important: Layer 2 sees the raw text; the masked text feeds the rest of the chain

By the time this module runs, Layer 1 has produced both `raw_text` and `clean_text`. Denis's transformer is sent the **raw** text — PII tokens like `[PERSON_1]` confuse the classifier and inflate scores. Everything downstream of Layer 2 (Layer 3, the response payload, the dashboard) only ever sees `clean_text`. Do not leak raw text past Layer 2.

## Layer 2 — Denis ML (Gradio Space)

- Provider: **Denis's Hugging Face Space** (`https://zonda001-poison-defense.hf.space`), our fine-tuned `Zonda001/poison-defense-text` transformer behind Gradio 5.x REST.
- Client: `src/lib/ai/denisClient.ts` → `scanTextDenis(text)`.
- Output: `{ predicted_attack_type: "clean" | "prompt_injection", poison_probability, trust_weight, ... }`.
- Score-to-verdict thresholds (only escalate on extreme scores — the transformer floors at ~0.9):
  - `type === "clean"` → always `allow`
  - `type === "prompt_injection"` and `score >= 0.99` → `block`
  - `type === "prompt_injection"` and `score >= 0.96` → `warn`
  - otherwise → `allow`
- The response DTO still carries `agents: { semantic, logic }` for dashboard backwards-compat. `semantic` holds Denis's verdict/score; `logic` is a fixed `{ allow, 0 }` placeholder.

### Fail-closed via mock

If Denis throws (timeout, 5xx, malformed SSE), or `DEMO_MODE === "true"`, the pipeline falls back to `mockLayer2(cleanText)` from `demoMode.ts`. **Never silently return a default `allow`** — that lets an attacker DoS the Space to bypass Layer 2. The mock pattern-matches injection markers and returns a real verdict.

All of this lives behind a single helper:

```ts
export async function runLayer2Pipeline(
  cleanText: string,
  rawText: string,
): Promise<Layer2Report>;
```

Both `/api/v1/sanitize` and `/api/v1/sanitize/batch` call it. Cache logic stays in the routes — the helper just produces the verdict.

### DEMO_MODE shim (`demoMode.ts`) must:

- Pattern-match a small list of injection markers (e.g. "ignore previous", "you are now", "developer mode").
- Vary the verdict with input so demos do not look static.
- Set `demoMode: true` on the report.
- Pad latency to ~400 ms so the demo feels real.

## Layer 3 (opt-in)

Lives in `src/lib/ai/integrity/`. Runs only when the request opted in via `config.integrity.check_autophagy === true`.

- First choice: Hugging Face Inference API (`roberta-base-openai-detector`) — no key required.
- Fallback: local heuristic over AI-filler phrases + bullet density.
- Output: `Layer3Report` with `synthetic_paragraphs_removed` and `confidence`.
- Layer 3 failure must **never** fail the whole sanitize call.

## Public surface

Export from `src/lib/ai/index.ts`:

```ts
export async function runLayer3(
  cleanText: string,
  opts: { enabled: boolean }
): Promise<Layer3Report>;
```

`runLayer2Pipeline` is exported from `src/lib/ai/layer2Pipeline.ts` directly (it is the only Layer 2 entry point — the old `runLayer2` Groq path has been removed).

## Layout

```
src/lib/ai/
  index.ts              // public entry: runLayer3
  layer2Pipeline.ts     // Denis → mockLayer2 fallback pipeline
  denisClient.ts        // Gradio Space REST client
  demoMode.ts           // mockLayer2 shim
  fusion.ts             // verdict fusion helpers
  chunking.ts           // text chunking utilities (kept for tests)
  integrity/
    runLayer3.ts
```

## Do not import

- Any React, any Next.js client-only API, any Supabase.
- `src/lib/sanitizer/**` — Layer 2 is downstream. The route composes them, not us.
- `groq-sdk` — removed from dependencies along with the abandoned Groq path.
