# Zone B — Dashboard Components

You are inside `src/components/dashboard/**`. These are feature components for the Threat Inspector.

## Local rules

- **Props are typed against `@/types/scan`** — never re-declare the response shape.
- Each component is a single file under PascalCase: `ThreatInspector.tsx`, `LayerTrail.tsx`, `LiveAttackPanel.tsx`, etc. No barrel index files for MVP (they break HMR snapshots).
- Components must render meaningfully for both `metadata.layer2.demoMode: true` and `demoMode: false` responses.
- Layer 3 is **opt-in**. When `metadata.layer3.enabled === false`, render the Layer 3 card greyed-out with a "Disabled" pill, not hidden.
- `tokenMap` values are real, unmasked PII — treat them as sensitive. The `<TokenMapTable />` must be collapsed by default with a "Reveal" button, and never render values via `dangerouslySetInnerHTML`.
- Any text that came from the document (X-Ray view, injection evidence, paragraph previews) is **attacker-controlled** — render as `<pre>{value}</pre>` or `<span>{value}</span>`, never via `dangerouslySetInnerHTML`. See `docs/SECURITY.md`.
- All accent colours flow through Tailwind tokens — no hex literals.
- A component file that fetches data is a Client Component (`"use client"` at the top); display-only components stay server-rendered.

## Do not put here

- Generic UI primitives — those live in `src/components/ui/` (shadcn).
- API clients or fetch logic — that belongs in the route page (Client Component) or the SDK.
- Imports from `src/lib/ai/**`, `src/lib/sanitizer/**`, or `src/app/api/**`.
