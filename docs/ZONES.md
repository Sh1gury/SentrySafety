# Zones & Ownership

Four encapsulation zones inside `app/`. The whole point of zones is **merge-conflict immunity over a 26-hour sprint**. Stay in your zone.

## Zone A — API & AI Core (Anton)

**Owns:**
- `src/app/api/**` — all Next.js Route Handlers, primarily `POST /api/v1/sanitize`.
- `src/lib/sanitizer/**` — Layer 1: PII regex, NER (`wink-nlp`), MIME, zip-bomb, macros, injection signatures, tokenisation.
- `src/lib/ai/**` — Layer 2: Denis ML Gradio Space client (`denisClient.ts`), `layer2Pipeline.ts` (DEMO_MODE / Denis / `mockLayer2()` fallback chain), fusion. Layer 3: Hugging Face Inference API + heuristic fallback.
- `next.config.ts`, `package.json` (top-level deps), `.env.example`.

**Public contract:**
- `POST /api/v1/sanitize` — see [API.md](API.md).
- The exported types in `src/types/scan.ts` (changes require sign-off).

**Allowed to import:** anything in `src/lib/sanitizer/**`, `src/lib/ai/**`, `src/types/**`, Node/Next stdlib, `wink-nlp`. No LLM SDKs — Denis is reached via `fetch`, HF Inference API via `fetch`.
**Forbidden to import:** anything from `src/components/**` or `src/app/dashboard/**`. The API has no idea the UI exists.

## Zone B — Dashboard UI (Frontend Engineer)

**Owns:**
- `src/app/dashboard/**` — the Threat Inspector pages.
- `src/components/dashboard/**` — feature components (uploaders, threat cards, charts, X-Ray toggle).

**Public contract:** consumes `POST /api/v1/sanitize` (via Bogdana's SDK or direct fetch). Renders the JSON verdict + PII token map + threat metadata.

**Allowed to import:** `@/types/scan`, `@/components/ui/*` (shadcn primitives), `@/lib/sdk/*` (Bogdana's client).
**Forbidden to import:** anything from `src/lib/ai/**`, `src/lib/sanitizer/**`, or `src/app/api/**` *source* directly. Call the API over HTTP; never reach into the implementation.

The dashboard **is the demo**. If a feature is invisible to the dashboard, it does not exist on stage.

## Zone C — DevEx & Integration (Bogdana)

**Owns:**
- `src/lib/sdk/**` — the TypeScript wrapper (`SentrySafety` class, `sanitize(doc, config)`).
- `src/app/page.tsx` — landing page.
- `src/app/docs/**` — SDK quickstart, code samples, "Get an API key" flow.

**Public contract:** the SDK's external surface — class names, method signatures, error types. Anything imported as `from "@sentry-safety/sdk"` is public API.

**Allowed to import:** `@/types/scan`, global `fetch`, minimal helpers. The SDK must be runnable in Node and the browser.
**Forbidden:** importing server-only code, Supabase, `src/lib/ai/**`, or `src/lib/sanitizer/**`. The SDK speaks HTTP, nothing else.

## Zone D — Local Tests (shared)

**Owns:**
- `tests/**` — smoke tests and unit tests. Standalone scripts run via `npx tsx`.

Lightweight: confirms the dev server is alive, the sanitize endpoint validates input correctly, and the SDK round-trips. Adversarial regression harness is handled out-of-band; see [tests/AGENTS.md](../tests/AGENTS.md).

**Allowed to import:** nothing from `src/**`. Tests go through HTTP only.

## The shared DTO (`src/types/scan.ts`)

Every zone consumes it. Nobody edits it without group consent. Treat it as v1.0 of a published API.

- Adding a field with `?` (optional): generally safe, flag in chat.
- Renaming a field: requires sign-off from all four zones.
- Removing a field: never during the hackathon.

## Cross-zone communication checklist

When you genuinely need to touch another zone (e.g. Frontend needs a new field on `SanitizeResponse`):

1. Stop. Do not edit it yourself.
2. Post the proposed shape in team chat.
3. Anton (or the owner) applies the change to `src/types/scan.ts`.
4. Each affected zone re-pulls and adapts.

This sounds heavy. It is faster than untangling a merge conflict at hour 22.

## Quick "can I touch this file?" reference

| File / path | Can edit |
|-------------|----------|
| `src/app/api/**` | Anton only |
| `src/lib/sanitizer/**` | Anton only |
| `src/lib/ai/**` | Anton only |
| `src/app/dashboard/**` | Frontend only |
| `src/components/dashboard/**` | Frontend only |
| `src/components/ui/**` | Anyone may **add** via `npx shadcn add`; nobody renames existing files |
| `src/lib/sdk/**` | Bogdana only |
| `src/app/page.tsx`, `src/app/docs/**` | Bogdana only |
| `tests/**` | Frontend / Anton (lightweight only) |
| `src/types/scan.ts` | Anyone — but only after team agreement |
| `package.json`, `next.config.ts`, `tsconfig.json` | Anton only |
| `.env.example` | Anton edits; others add a new key only after asking |
| `middleware.ts`, `src/lib/supabase/**`, auth routes | Do not edit during MVP |
