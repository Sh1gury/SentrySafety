# Zone B — Dashboard (Frontend Engineer)

You are inside `src/app/dashboard/**`. This is the Threat Inspector — the UI the jury actually sees.

Read first: repo root `AGENTS.md`, `docs/API.md`, `docs/DEMO.md`, and `src/types/scan.ts`.

## Local rules

- This route already exists with a Supabase-protected access pattern (`middleware.ts` redirects unauthenticated users to `/login`). For the MVP demo, **bypass that gate**: either temporarily relax the middleware matcher or auto-create a session. Coordinate with Anton before changing `middleware.ts`.
- All UI types come from `@/types/scan`. Never re-declare `SanitizeResponse` locally.
- Server Components by default. Drop to `"use client"` only for interactive parts (uploader, X-Ray toggle, live log, live-attack panel).
- Call the API with `fetch("/api/v1/sanitize", ...)` from a Client Component **or** use Bogdana's SDK (`@/lib/sdk`) once it is ready. Do not import server code.
- Show `metadata.layer2.demoMode: true` responses with a visible "MOCK" badge. Honesty about the fallback earns more trust than hiding it.
- The **three-layer trail** is the centrepiece of the dashboard. Show each layer as its own card with its own verdict, counters, and timestamp. The user must see at a glance that Layer 1 protects PII before Layer 2 ever sees the text.

## Components you will need (live under `src/components/dashboard/`)

- `<DocumentDropzone />` — drag-and-drop, single file.
- `<ThreatInspector />` — top-level verdict header + the three-layer trail + threats list.
- `<XRayToggle />` — re-renders the document with hidden-text spans highlighted.
- `<LayerTrail />` — three vertical cards: Layer 1, Layer 2, Layer 3 (greyed when disabled).
- `<TokenMapTable />` — shows the PII tokenisation (`PERSON_1 → "Богдана В."`). Sensitive; default-collapsed.
- `<ScanLogTable />` — last N scans (in-memory; no persistence in MVP).

## Style

- Dark mode by default (`next-themes` already wired).
- Aesthetic: enterprise cyber-security. Mono fonts for hashes / scan IDs / tokens, restrained accent colour for severity, no emoji, no gradients on copy.
- shadcn primitives (`@/components/ui/*`) — add new ones via `npx shadcn add`, never hand-roll.

## Do not edit

- `src/app/api/**`, `src/lib/sanitizer/**`, `src/lib/ai/**`, `src/lib/sdk/**`, `src/types/scan.ts`.
- `src/app/page.tsx` and `src/app/docs/**` (Bogdana owns those).
