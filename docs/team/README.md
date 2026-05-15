# Team Playbooks

Sentry Safety has three engineers, each owning a zone. When Claude Code starts a session in this repo it does not know which one of them is sitting at the keyboard. **The human tells it.**

Each file in this directory is a per-role playbook: shortcuts, skill recommendations, model-selection hints, and things only that role does. They are short on purpose — read your own once, then keep working.

| Role | Zone | Playbook |
|------|------|----------|
| Anton — Backend & AI Core | A | [anton.md](anton.md) |
| Frontend Engineer | B | [frontend.md](frontend.md) |
| Bogdana — DevEx & Integration | C | [bogdana.md](bogdana.md) |

## How to use these

Two options.

**Option 1 — declare per session.** At the start of a Claude Code session, say:

> I am Anton. Read `docs/team/anton.md`.

The agent loads the playbook, picks the right model and skills, and stays in your zone.

**Option 2 — make it sticky.** Add one line to your user-level `~/.claude/CLAUDE.md`:

```
When working in d:/Infomatrix_2026/app, I am Anton (Zone A). Read docs/team/anton.md before doing anything.
```

This persists across sessions on **your** machine only — your teammates' agents do not see it. Each teammate writes their own line with their own name.

## Cross-zone notes

- The shared DTO `src/types/scan.ts` is touched by everyone but owned by no one. Changes go through team chat first (see [ZONES.md](../ZONES.md)).
- Anybody on the team may write inside `tests/**`. There is no playbook for it — [tests/AGENTS.md](../../tests/AGENTS.md) is short enough on its own.
- If a session starts and the user has not declared who they are, **ask them**. Do not guess from the open file — multiple zones can edit `src/types/scan.ts` and that is a trap.
