# Zone A — API Routes (Anton)

You are inside `src/app/api/**`. This is the HTTP surface of Sentry Safety. Read these before anything:

- `../../../AGENTS.md` (repo root)
- `../../../docs/API.md` — wire format
- `../../../docs/SECURITY.md` — non-negotiable rules
- `../../../docs/ARCHITECTURE.md` — three layers

## Local rules

- Every handler is a Route Handler (`POST`, `GET`, ...) per Next.js 16 conventions. **Read `node_modules/next/dist/docs/` for the current shape — do not assume App Router conventions from training data.**
- The primary route is **`POST /api/v1/sanitize`**, file at `src/app/api/v1/sanitize/route.ts`.
- All handlers must:
  1. Validate input with a small inline schema (no Zod yet — minimise deps).
  2. Run **Layer 1 before Layer 2**. Always. Even when `DEMO_MODE=true`.
  3. Honour `process.env.DEMO_MODE === "true"` before doing any Layer 2 LLM call.
  4. Skip Layer 3 unless `request.config.integrity.check_autophagy === true`.
  5. Return the shape defined in `@/types/scan` (`SanitizeResponse`). Period.
  6. Never log `request.body` or document content at INFO level.
- Errors are JSON, not HTML. Always set `Content-Type: application/json`. Use the `SanitizeError` shape.
- CORS: when called from the dashboard (same origin), no CORS needed. When called from the simulator (different origin, port 4000), allow `http://localhost:4000` in dev.

## Files in your purview

- `src/app/api/v1/sanitize/route.ts` — primary endpoint. Composes Layer 1 → Layer 2 → optional Layer 3.
- `src/app/api/health/route.ts` — `GET` returning `{ ok: true, demoMode, version }`. Used by simulator + smoke tests.

## Do not edit from this directory

- `src/components/**`, `src/app/dashboard/**`, `src/app/page.tsx`, `src/app/docs/**`, `src/lib/sdk/**`.
- `middleware.ts` without coordinating with Frontend (it currently blocks `/dashboard`).
