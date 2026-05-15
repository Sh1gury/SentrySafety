# Playbook — Frontend Engineer (Zone B: Dashboard UI)

When the user identifies as Frontend, treat this file as authoritative for model selection, skill choice, and tooling defaults. It complements — does not override — the zone-specific `AGENTS.md` files.

## Your zone

- `src/app/dashboard/**` — Threat Inspector pages.
- `src/components/dashboard/**` — feature components (dropzone, layer trail, X-Ray toggle, token-map table, scan log).

You consume `POST /api/v1/sanitize` via `fetch` or via Bogdana's SDK. You **never** reach into `src/lib/ai/**` or `src/lib/sanitizer/**`.

The dashboard **is the demo**. If a feature is invisible to the dashboard, it does not exist on stage.

## Model choice for this session

| Task | Pick |
|------|------|
| Hero / layout / first design pass on a new screen | `/model opus` with `frontend-design:frontend-design` |
| Implementing components one by one | `/fast` (Opus 4.6 fast mode) |
| Tweaking Tailwind, copy, props | `/model haiku` |
| Refactoring component tree | `/model sonnet` |

## Skills to keep nearby

| Skill | Trigger |
|-------|---------|
| `vercel:knowledge-update` | Run once at session start. |
| `vercel:nextjs` | Server vs Client Components, App Router, route groups. **Next 16 has breaking changes — do not trust training data.** |
| `vercel:shadcn` | Adding shadcn components (`npx shadcn add`), composition patterns, theming. |
| `vercel:react-best-practices` | After editing several `.tsx` files — runs a condensed quality checklist. |
| `frontend-design:frontend-design` | For the dropzone, the three-layer trail, the verdict header — anything that needs polish. Use aggressively. |
| `vercel:turbopack` | If HMR breaks or builds get weird. |
| `simplify` | After implementing a flow. Catches duplicated components and unused props. |

## MCP / library docs (use Context7)

Type "check Context7 for X" or trigger `context7` directly. Fresh docs you will need:

- `@base-ui/react` — primitives used by shadcn (Dialog, Popover, Tabs).
- `lucide-react` — icon set.
- `sonner` — toast notifications.
- `next-themes` — dark-mode wiring (already in place).
- `tailwindcss` v4 — new class semantics, container queries.

## Hot rules you will forget under pressure

1. **`evidence` strings and `tokenMap` values are attacker-controlled.** Render via `<span>{value}</span>` or `<pre>{value}</pre>`. Never `dangerouslySetInnerHTML`.
2. **Server Components by default.** Drop to `"use client"` only when you actually need interactivity.
3. **`metadata.layer2.demoMode: true` → show a "MOCK" badge.** Honesty about the fallback beats hiding it.
4. **The three-layer trail is the demo centrepiece.** Each layer is its own card with its own counters and verdict.
5. **TokenMap is sensitive.** Default-collapsed, "Reveal" button required, never auto-expanded.
6. **No emoji in product UI.** Enterprise security aesthetic. Mono fonts for hashes/scan IDs/tokens.

## Do not touch

- `src/app/api/**`, `src/lib/sanitizer/**`, `src/lib/ai/**`, `src/lib/sdk/**`, `src/types/scan.ts`.
- `src/app/page.tsx` and `src/app/docs/**` (Bogdana owns those).

## Git

Branch prefix: `zone-b/<slug>` (e.g. `zone-b/dropzone-ui`).  
Commit prefix: `[B] type: description`.

Run `npm run lint -- --fix` before every merge. Your zone has no conflicts with A or C by design — if you see one, stop and call the owner of the other file. Full workflow: [docs/GIT.md](../GIT.md).

## Quick commands

```bash
npm run dev                                   # http://localhost:3000/dashboard
npx shadcn add card tabs alert badge          # add primitives as needed
npm run lint -- --fix                         # before committing
```
