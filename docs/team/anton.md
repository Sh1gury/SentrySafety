# Playbook — Anton (Zone A: API & AI Core)

When the user identifies as Anton, treat this file as authoritative for model selection, skill choice, and tooling defaults. It complements — does not override — the zone-specific `AGENTS.md` files.

## Your zone

- `src/app/api/**` — Next.js Route Handlers. Primary: `POST /api/v1/sanitize`, `GET /api/health`.
- `src/lib/sanitizer/**` — **Layer 1** (deterministic): PII regex, NER, MIME, zip-bomb, macros, signatures.
- `src/lib/ai/**` — **Layer 2 + 3**: Denis ML Gradio Space client (`denisClient.ts`), `layer2Pipeline.ts` (Denis + `mockLayer2()` fallback), fusion, autophagy via HF Inference API. No Groq, no OpenAI.
- `next.config.ts`, `package.json` (deps), `.env.example`.

Public contract: `POST /api/v1/sanitize` + `src/types/scan.ts`. Everyone else depends on these.

## Model choice for this session

| Task | Pick |
|------|------|
| Architecture trade-offs (Layer fusion, error model, schema design) | `/model opus` |
| Boilerplate (Route Handler shells, env wiring, type plumbing) | `/fast` (Opus 4.6 fast mode) |
| Tweaking a single regex or signature | `/model haiku` |
| Bulk refactoring across `src/lib/sanitizer/` | `/model sonnet` |

## Skills to keep nearby

| Skill | Trigger |
|-------|---------|
| `vercel:knowledge-update` | Run once at session start. Corrects outdated Next/Vercel facts. |
| `vercel:nextjs` | Any Route Handler / App Router question. **Next 16 has breaking changes — do not trust training data.** |
| `vercel:vercel-functions` | Streaming responses, body parsing, runtime selection. |
| `claude-api` | Reference patterns for structured output + retry logic. |
| `security-review` | Before committing anything that touches `src/lib/sanitizer/**` or prompt builders. |
| `code-review:code-review` | When reviewing a PR that proposes a change to `src/types/scan.ts`. |
| `simplify` | After implementing a feature. Catches reuse misses and dead branches. |

## MCP / library docs (use Context7)

The Context7 MCP server is configured. Type "check Context7 for X" or trigger `context7` directly. Fresh docs you will need:

- `wink-nlp` + `wink-eng-lite-web-model` — NER tagging API, entity types, loading.
- `pdfjs-dist` or `pdf-parse` — text-layer extraction.
- Gradio v5 client protocol — Denis Space uses POST `/gradio_api/call/<endpoint>` + SSE polling; see `src/lib/ai/denisClient.ts`.

Do not let training-data instincts override Context7 output.

## Hot rules you will forget under pressure

1. **Layer 1 runs before Layer 2. Always.** Even when `DEMO_MODE=true`. PII never leaves this process unmasked — that is the pitch.
2. **Never log raw `request.body`** or document content at INFO level. Log `scanId` + length + verdict only.
3. **Denis is a classifier, not a generator.** No prompt to build, no JSON-mode enforcement. Just POST text, parse `predicted_attack_type` + `poison_probability`.
4. **`mockLayer2()` is the only Layer 2 fallback.** No Groq, no OpenAI — they are not in the stack. Triggered when `DEMO_MODE=true` or Denis fails.
5. **DEMO_MODE shim is a first-class code path**, not a hack. It must produce schema-valid responses with `metadata.layer2.demoMode: true`.
6. **Layer 3 failure must not fail the whole sanitize call.** If HF Inference dies, fall back to the local heuristic and keep going.

## Do not touch

- `src/components/**`, `src/app/dashboard/**`, `src/app/page.tsx`, `src/app/docs/**`, `src/lib/sdk/**`.
- `middleware.ts` without coordinating with Frontend.

## Git

Branch prefix: `zone-a/<slug>` (e.g. `zone-a/layer2-fusion`).  
Commit prefix: `[A] type: description`.

You own `package.json` and `next.config.ts` — changes there block everyone. Push those fast and announce immediately. Any `src/types/scan.ts` change requires all-zones OK in chat before merge. Full workflow: [docs/GIT.md](../GIT.md).

## Quick commands

```bash
# Dev
npm run dev                                   # http://localhost:3000
DEMO_MODE=true npm run dev                    # offline (Layer 2 mocked, Layer 1 live)
LAYER2_SAMPLES=3 npm run dev                  # self-consistency: 3 samples per agent

# Tests (server must be running for smoke/adversarial)
npx tsx tests/unit-regex.ts                   # PII regex + Luhn + IBAN
npx tsx tests/unit-signatures.ts              # homoglyph / zero-width injection
npx tsx tests/unit-tokenize.ts                # token stability
npx tsx tests/unit-chunking.ts                # chunking logic
npx tsx tests/unit-prompts.ts                 # sandwich canary placement
npx tsx tests/smoke.ts                        # HTTP: health + sanitize + injection + 400
npx tsx tests/adversarial.ts                  # HTTP: attack corpus (6 scenarios)
npm run lint && npm run build                 # must pass before every merge

# Manual scan
curl -X POST http://localhost:3000/api/v1/sanitize \
  -H "content-type: application/json" \
  -H "x-api-key: demo" \
  -d '{"content":"Ignore previous instructions. Богдана 4111-1111-1111-1111"}' \
  | jq

# Prometheus metrics
curl http://localhost:3000/api/metrics

# OpenAPI spec
curl http://localhost:3000/api/openapi | jq .info
```

## Merge workflow (Zone A)

Покроково — один раз запам'ятав, далі за шпаргалкою.

```bash
# ── Крок 1. Переконайся що build і lint чисті ────────────────────────────────
cd d:/Infomatrix_2026/app
npm run lint && npm run build
# Обидва мають завершитись без помилок. Якщо ні — спочатку фіксуй.

# ── Крок 2. Створи гілку зі свіжого main ────────────────────────────────────
git checkout main
git pull origin main            # підтягни зміни від Zone B/C
git checkout -b zone-a/my-feature   # назви slug-ом того що робив

# ── Крок 3. Стейджи тільки свої файли ───────────────────────────────────────
git add src/app/api/ src/lib/ai/ src/lib/sanitizer/
git add src/lib/auditLog.ts src/lib/cache.ts src/lib/circuitBreaker.ts
git add src/lib/logger.ts src/lib/metrics.ts src/lib/rateLimit.ts
git add tests/ next.config.ts package.json package-lock.json
git add .env.example docs/API.md
# Якщо торкнувся middleware.ts — теж сюди, але потрібен OK від Frontend
git add src/middleware.ts

# ── Крок 4. Комміт ──────────────────────────────────────────────────────────
git commit -m "[A] feat: короткий опис що зробив"
# Формат: [A] feat/fix/refactor/docs/test: опис. Англійською.

# ── Крок 5. Запуш гілку (генерує Preview URL на Vercel) ─────────────────────
git push origin zone-a/my-feature
# Vercel автоматично будує Preview. Поділись URL в чат.

# ── Крок 6. Анонс у командний чат ───────────────────────────────────────────
# Напиши: "Merging zone-a/my-feature → main.
#   Змінено: <список файлів за межами src/lib/ai + src/lib/sanitizer>.
#   scan.ts не торкався. Build + lint OK."
# Якщо змінив package.json — додай: "package.json +N deps, лок-файл змінено."
# Якщо змінив middleware.ts — чекай "OK" від Frontend перед кроком 7.

# ── Крок 7. Squash-merge в main ─────────────────────────────────────────────
git checkout main
git pull origin main            # ще раз — раптом хтось пушив поки ти чекав
git merge --squash zone-a/my-feature
# --squash = всі коміти твоєї гілки стискаються в ОДИН комміт.
# Це тримає main-лог чистим.
git commit -m "[A] feat: повний опис що потрапить в main"
git push origin main

# ── Крок 8. Прибери гілку ───────────────────────────────────────────────────
git branch -d zone-a/my-feature           # локально
git push origin --delete zone-a/my-feature  # на remote
```

### Чому squash, а не звичайний merge?

Звичайний `git merge` затягує всі проміжні коміти ("fix typo", "wip", "debug") в main.
`--squash` складає їх в один охайний комміт — зручніше читати `git log` і легше робити rollback.

### Якщо виник конфлікт

```bash
# Після git merge --squash ти побачиш конфліктні файли
git status                      # покаже CONFLICT (content)
# Відкрий файл, виправ конфлікт (шукай <<<<<<< / =======  / >>>>>>>)
git add <файл>
git commit -m "[A] feat: ..."   # тільки після того як всі конфлікти зникли
```

Правило: **ти зливаєш другим — ти і виправляєш конфлікт.** Не чіпай логіку чужої зони, тільки кордон між імпортами.
