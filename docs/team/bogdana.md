# Playbook — Bogdana (Zone C: DevEx & Integration)

When the user identifies as Bogdana, treat this file as authoritative for model selection, skill choice, and tooling defaults. It complements — does not override — the zone-specific `AGENTS.md` files.

## Your zone

- `src/lib/sdk/**` — the public TypeScript SDK (`SentrySafety` class, `sanitize(...)`, error types).
- `src/app/page.tsx` — landing page.
- `src/app/docs/**` — quickstart, API reference, SDK reference, threat catalogue.

Your work is what **integrators** see first and what the **jury sees second** (after the dashboard). The pitch headline — "PII never reaches OpenAI" — is your landing copy.

## Model choice for this session

| Task | Pick |
|------|------|
| SDK API design (class shape, error types, options object) | `/model opus` |
| Landing copy + hero composition | `/model opus` with `frontend-design:frontend-design` |
| Component-by-component build of docs pages | `/fast` (Opus 4.6 fast mode) |
| Style and copy tweaks | `/model haiku` |

## Skills to keep nearby

| Skill | Trigger |
|-------|---------|
| `vercel:knowledge-update` | Run once at session start. |
| `vercel:nextjs` | Landing and docs pages — App Router, metadata, OG images. **Next 16 — do not trust training data.** |
| `vercel:shadcn` | Composition for cards, tabs, code blocks on the docs page. |
| `frontend-design:frontend-design` | Hero, "three-layer" diagram, code-sample blocks. Use this aggressively — the landing has to look enterprise-grade. |
| `vercel:ai-sdk` | Contextual reference. We do not use AI SDK at runtime, but their quickstart patterns are excellent templates for ours. |
| `code-review:code-review` | When reviewing a PR that touches `src/types/scan.ts` from a consumer's perspective. |
| `simplify` | After shipping the SDK. Catches accidental coupling and over-abstraction. |

## MCP / library docs (use Context7)

Type "check Context7 for X" or trigger `context7` directly. Fresh docs you will need:

- `@base-ui/react` — primitives.
- `lucide-react` — icons.
- `next-themes` — for dark-mode toggle on the landing.
- `tailwindcss` v4 — for the docs page's prose styling.

## Hot rules you will forget under pressure

1. **The SDK has zero non-stdlib dependencies.** If you reach for one, it must be tiny and live inside `src/lib/sdk/`.
2. **Browser + Node runtime targets.** Use global `fetch`. No Node-only imports (`fs`, `path`, etc.).
3. **Imports allowed: `@/types/scan` only.** The SDK speaks HTTP; it never imports server code, Supabase, AI, or sanitizer.
4. **Error model:** throw `SentrySafetyError` subclasses carrying `code: SanitizeErrorCode`. Match the API exactly.
5. **Landing message: "PII never reaches the LLM."** That is the headline (Groq only sees tokenised text). The three-layer diagram makes it credible.
6. **Docs page must work on mobile.** Jury may pull it up on phones during Q&A.

## Do not touch

- `src/app/api/**`, `src/lib/ai/**`, `src/lib/sanitizer/**`, `src/types/scan.ts`.
- `src/app/dashboard/**` or `src/components/dashboard/**` (Frontend owns those).

## Git

Branch prefix: `zone-c/<slug>` (e.g. `zone-c/sdk-retry`).  
Commit prefix: `[C] type: description`.

SDK changes affect every integrator immediately. Before merging anything that changes `src/lib/sdk/index.ts`'s public surface, confirm Frontend has no pending imports that break. Share the Preview URL so they can verify the SDK round-trip. Full workflow: [docs/GIT.md](../GIT.md).

## Quick commands

```bash
npm run dev                                   # http://localhost:3000 (landing)
                                              # http://localhost:3000/docs

# SDK round-trip:
npx tsx tests/sdk-roundtrip.ts

# Production build (verify landing renders cleanly):
npm run build && npm run start
```
