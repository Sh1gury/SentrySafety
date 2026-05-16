# Zone C — SDK (Bogdana)

You are inside `src/lib/sdk/**`. This is the public-facing TypeScript SDK.

Read first: repo root `AGENTS.md`, `docs/API.md`, `src/types/scan.ts`.

## Goal

A drop-in client so an engineer integrates Sentry Safety in one line:

```ts
import { SentrySafety } from "@sentry-safety/sdk";

const shield = new SentrySafety({ apiKey: process.env.SENTRY_SAFETY_KEY! });
const { clean_text, verdict } = await shield.sanitize(file, {
  privacy:  { mask_pii: true, entities_to_mask: ["PERSON", "PHONE", "IBAN"] },
  security: { block_injections: true, max_decompression_ratio: 100, strip_macros: true },
  integrity:{ check_autophagy: false },
});

if (verdict !== "allow") throw new Error("blocked");
// clean_text is safe to embed into the RAG pipeline
```

## Local rules

- **Runtime targets:** modern Node (>= 20) and browsers. Use global `fetch`. No Node-only imports.
- **Zero non-stdlib dependencies.** If you reach for one, it has to live inside `src/lib/sdk/` only and be tiny.
- **Imports allowed:** `@/types/scan` only. The SDK speaks HTTP; it does not import server code.
- **Error model:** throw a `SentrySafetyError` subclass with a `code: SanitizeErrorCode` matching the API. The dashboard and Zone E both depend on this.
- **Config is partial-by-default.** If the caller omits a section, send the request without that section — let the server apply defaults (documented in `docs/API.md`).
- **No telemetry, no auto-logging.** Keep it boring.

## File layout

```
src/lib/sdk/
  index.ts      // public exports
  client.ts     // the SentrySafety class
  errors.ts     // SentrySafetyError + subclasses
  types.ts      // re-exports from @/types/scan so users do not reach into internals
```

## Landing & docs (you also own these)

You also own the user-facing surface outside the dashboard:

- `src/app/page.tsx` — landing page. Hero, "three-layer" diagram, install snippet, "PII never reaches the LLM" headline.
- `src/app/docs/page.tsx` (and sub-pages) — quickstart, full API reference, SDK reference, threat catalogue, three-layer explanation.

Both must look good on mobile (jury may pull it up on phones). Use shadcn `Card`, `Tabs`, code-block patterns.

## Packaging note

Start inside `src/lib/sdk/**` so it shares the lockfile. If time allows, mirror into `packages/sentry-safety-sdk/` with its own `package.json` for an npm-publishable shape. Do **not** block the demo on packaging.
