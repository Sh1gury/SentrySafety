<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sentry Safety — Agent Operating Manual

This file is loaded into every Claude Code session in this repository. It is the single source of truth for AI agents working on Sentry Safety.

## What we are building

**Sentry Safety** is a pre-RAG firewall: a B2B SaaS middleware that scans, sanitises, and anonymises documents before they reach a corporate RAG knowledge base. Three layers, one HTTP call.

- Event: Infomatrix 2026 Global Final — Cybersecurity & Privacy track, Bucharest.
- Duration: 26 hours total. Optimise for a working demo over architectural purity.
- Audience: technical jury + prospective B2B integrators.
- Architecture: stateless API, in-memory only, no document persistence.

### The three layers (read this twice)

1. **Layer 1 — Deterministic.** Local, no LLM. Regex PII (IBAN, cards, phones), NER (PERSON/ORG/LOC) via `wink-nlp`, MIME magic-byte check, zip-bomb decompression-ratio guard, DOCX macro stripping, prompt-injection signature list. Always on, runs offline.
2. **Layer 2 — Semantic.** **Denis ML** — our own fine-tuned transformer classifier (`Zonda001/poison-defense-text`) served from a Gradio Space at `https://zonda001-poison-defense.hf.space`. Binary output: `predicted_attack_type ∈ { "clean", "prompt_injection" }` plus a `poison_probability` score used for warn/block escalation. The response DTO still exposes `agents: { semantic, logic }` for dashboard backwards-compat; `semantic` carries Denis's output, `logic` is a fixed `{ allow, 0 }` shape placeholder. When `DEMO_MODE=true` or Denis is unreachable, `mockLayer2()` short-circuits this layer.
3. **Layer 3 — Integrity (opt-in).** Detects AI-generated slop to prevent vector-store autophagy. Off by default; enabled per request via `config.integrity.check_autophagy`.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Who are you?

This repository is built by three engineers plus shared tests. Before doing anything you need to know which one of them is sitting at the keyboard. Open the matching playbook — it picks the right model, the right skills, and the right zone:

- **Anton — Backend & AI Core** (Zone A) → [docs/team/anton.md](docs/team/anton.md)
- **Frontend Engineer** (Zone B) → [docs/team/frontend.md](docs/team/frontend.md)
- **Bogdana — DevEx & Integration** (Zone C) → [docs/team/bogdana.md](docs/team/bogdana.md)

If the user has not declared a role at session start, **ask them** before writing any code. Wrong-zone work is the most expensive mistake at hour 22. Index: [docs/team/README.md](docs/team/README.md).

## Repository layout (real paths)

Single Next.js 16 / React 19 app at `app/`. Paths below are relative to `app/`.

| Zone | Owner | Paths |
|------|-------|-------|
| A — API & AI Core | Anton | `src/app/api/**`, `src/lib/ai/**`, `src/lib/sanitizer/**` |
| B — Dashboard UI | Frontend Engineer | `src/app/dashboard/**`, `src/components/dashboard/**` |
| C — DevEx & Integration | Bogdana | `src/lib/sdk/**`, `src/app/page.tsx` (landing), `src/app/docs/**` |
| D — Local Tests | Frontend / Anton shared | `tests/**` (smoke + unit) |

Shared and read-only-by-default for non-owners:

- `src/types/scan.ts` — shared DTO between **every** zone. Changes require team sign-off.
- `src/lib/supabase/*`, `src/actions/auth.ts`, `src/app/login`, `src/app/register`, `src/app/auth`, `middleware.ts` — auth scaffolding, post-MVP. Do not refactor or remove.
- `src/components/ui/*` — shadcn primitives. Add via `npx shadcn add`; do not rename.
- `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example` — Anton owns top-level config.

Full ownership table and contract rules: [docs/ZONES.md](docs/ZONES.md).

## Cross-cutting rules for every agent

1. **Stay in your zone.** If a task requires touching another zone, stop and ask. Cross-zone edits are how 26-hour hackathons die.
2. **Never edit `src/types/scan.ts` without flagging it.** That file is the contract between all four zones. Treat it like a public API.
3. **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before designing anything.** It explains the three layers, Denis ML, and `DEMO_MODE` — concepts your training data does not cover.
4. **No new top-level dependencies without discussion.** `npm install` shifts the lockfile. Justify each new package in chat first.
5. **Layer 1 runs first, always.** Even when `DEMO_MODE=true`. Layer 1 is what protects user PII from ever reaching the LLM — that property is non-negotiable.
6. **Supabase is post-MVP.** Auth screens (`/login`, `/register`), `src/lib/supabase/*`, and the auth middleware are scaffolded but should not gate the demo. Route around them; do not remove them.
7. **Optimise for the demo path.** Every change should be reachable from the live demo script in [docs/DEMO.md](docs/DEMO.md). If a feature cannot be shown on stage, deprioritise it.
8. **Honour `DEMO_MODE`.** When `DEMO_MODE=true`, Layer 2 short-circuits to `mockLayer2()` without calling Denis. Layer 1 keeps running normally. Venue Wi-Fi failure is the assumed failure mode.
9. **English only in code, docs, and commit messages.** Team-internal chat in Ukrainian is fine; artefacts that ship are English.
10. **No emojis in code, docs, or UI copy** unless a teammate asks for them. The product should look like enterprise security software.
11. **Pre-RAG, not post-RAG.** We refuse documents before they touch a vector store. If you find yourself scanning embeddings, you are in the wrong product.
12. **Follow the git workflow before every merge.** Branch per zone (`zone-a/`, `zone-b/`, `zone-c/`), squash-merge into `main`, announce in chat first. `main` must always pass `npm run build`. Full rules: [docs/GIT.md](docs/GIT.md).

## How to work with this codebase

- Dev server: `npm run dev` (Next 16, port 3000).
- Lint: `npm run lint`. Build: `npm run build`.
- TypeScript path alias: `@/*` → `src/*`.
- Each zone has its own `AGENTS.md`. When Claude Code opens a file inside a zone, that file's directives override anything generic here.
- The repo root `CLAUDE.md` is a thin alias to this file (`@AGENTS.md`). Keep them in sync.

## Documents you must read before non-trivial work

| When you are about to… | Read first |
|------------------------|-----------|
| Touch any API route, sanitizer, or LLM logic | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), [docs/SECURITY.md](docs/SECURITY.md) |
| Build any dashboard UI | [docs/ZONES.md](docs/ZONES.md), [docs/API.md](docs/API.md), [src/types/scan.ts](src/types/scan.ts) |
| Ship the SDK or landing/docs page | [docs/API.md](docs/API.md), [src/lib/sdk/AGENTS.md](src/lib/sdk/AGENTS.md) |
| Run the live demo | [docs/DEMO.md](docs/DEMO.md) |
| Commit or merge anything | [docs/GIT.md](docs/GIT.md) |

## Hard limits

- Do **not** rotate, exfiltrate, or log secrets from `.env.local`. Required keys live in `.env.example`.
- Do **not** commit `.env*` files (already in `.gitignore`; do not weaken).
- Do **not** ship a feature without a fallback for `DEMO_MODE=true`. If Denis Space dies on stage, the demo must still work via Layer 1 + `mockLayer2()`.
- Do **not** log raw document content. `scanId` + length + verdict only. Documents may be adversarial — see [docs/SECURITY.md](docs/SECURITY.md).
- Do **not** send unmasked PII to Denis. Layer 1 must run before Layer 2; this ordering is the product's main selling point.
