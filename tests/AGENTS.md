# Zone D — Local Tests (shared)

You are inside `app/tests/**`. This directory is **lightweight**: only smoke tests and a handful of unit tests that confirm the local dev server is alive and the API contract round-trips.

Read first: repo root `AGENTS.md`, `docs/API.md`.

## Local rules

- Tests are **standalone scripts** (`npx tsx tests/<name>.ts`). No Vitest / Jest in MVP — too much config burden.
- Every test points at `process.env.SENTRY_SAFETY_URL` (default: `http://localhost:3000`). Never hardcode hosts.
- Tests must work in two modes (env-controlled):
  - **Live:** `DEMO_MODE=false` on the server; Layer 2 calls OpenAI.
  - **Mock:** `DEMO_MODE=true` on the server; Layer 2 uses the shim. Layer 1 unaffected.

## What lives here

- `tests/smoke.ts` — `GET /api/health` + one happy-path `POST /api/v1/sanitize`. Used in the pre-demo checklist (see `docs/DEMO.md`).
- `tests/sdk-roundtrip.ts` — instantiates the SDK from `@/lib/sdk` and runs one sanitize call against the local server. Catches public-API regressions.
- `tests/types.ts` (optional) — TypeScript-only assertions that verify `SanitizeResponse` is structurally what the SDK and dashboard expect. No runtime cost.

## Do not

- Import from `src/lib/ai/**` or `src/lib/sanitizer/**`. Tests go through HTTP, end of story. (Tempting shortcut, but it lets bugs in the actual handler hide.)
- Commit captured response payloads from real LLM calls — they may contain attacker-controlled echoes.
