# Git Workflow — Sentry Safety

26-hour sprint. Rules are minimal but non-negotiable.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Always deployable. `npm run build` must pass. Vercel deploys from here. |
| `zone-a/<slug>` | Anton — API, sanitizer, AI layers. |
| `zone-b/<slug>` | Frontend — dashboard, components. |
| `zone-c/<slug>` | Bogdana — SDK, landing, docs. |

Slug is 1–3 words, kebab-case. Examples: `zone-a/layer2-fusion`, `zone-b/dropzone-ui`, `zone-c/sdk-retry`.

Keep branches short-lived. Open → merge within ~2 hours. If it lives longer, it will conflict.

## Commit messages

```
[A] feat: add sandwich prompt builder
[B] fix: collapse token map by default
[C] feat: sdk sanitize() with retry
[D] test: add smoke test for MIME mismatch
```

Format: `[Zone] type: short description`  
Zone letters: `A`, `B`, `C`, `D` (tests).  
Types: `feat`, `fix`, `refactor`, `docs`, `test`.  
English only. No emojis.

## Merge process

1. Run `npm run lint && npm run build` on your branch. Both must pass.
2. Announce in team chat: _"merging zone-b/dropzone-ui into main"_.
3. Squash-merge into `main`:
   ```bash
   git checkout main
   git merge --squash zone-b/dropzone-ui
   git commit -m "[B] feat: dropzone with drag-and-drop and file validation"
   git push origin main
   git branch -d zone-b/dropzone-ui
   ```
4. Delete the branch after merge.

No formal PR review — there is no time. The chat announcement is the review gate.

**Exception: `src/types/scan.ts`.**  
Any commit that touches this file needs an explicit "OK" from all three zones in chat before merge. See [ZONES.md](ZONES.md).

## Conflict rules

Zone isolation keeps conflicts rare. When one happens anyway:

- The person who merged **second** owns the resolution.
- Do not rewrite the other zone's logic to resolve. Adjust only imports and the shared boundary.
- If the fix is not obvious in five minutes, call the other engineer — do not guess.

## Hard rules for `main`

- `main` must always pass `npm run build`. If you break it, fix it before doing anything else — the other two engineers are blocked.
- Never force-push `main`.
- Never commit `.env.local` or any secret. `.gitignore` blocks it, but be aware.
- Never commit with a failing lint. `npm run lint` before every merge.

## Vercel

Every branch push generates a Preview URL automatically. Use it to verify your work before merging. Share the URL in chat — it is the fastest way to unblock your teammates.

Production URL deploys automatically when `main` is updated.

## Quick reference

```bash
# Start feature
git checkout main && git pull
git checkout -b zone-a/my-feature

# Ready to merge
npm run lint && npm run build        # must pass
git checkout main && git pull        # grab any teammate's changes
git merge --squash zone-a/my-feature
git commit -m "[A] feat: description"
git push origin main
git branch -d zone-a/my-feature
```
