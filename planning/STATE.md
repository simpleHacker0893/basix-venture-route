# STATE — rolling snapshot (edit in place, never append a log)

**Updated:** 2026-09-22 · **Demo:** Thu 2026-10-01 · **Current sprint:** 000 — MeTTa spike (not started)

## Where we are
- Operating Pack drafted by the Architect; awaiting Operator approval. Store decided: Neon Postgres (D-17). Builder prompts in `planning/PROMPTS.md`.
- Runtime spike done in the Architect session: `hyperon==0.2.10` (Python 3.11 wheel) ran a two-hop `verified-for-skill` rule and returned credential + project evidence. Python 3.12 wheels exist for Linux and macOS; no 3.13 wheel.
- Repo contains README, PRD-aligned stack, Stitch prompt pack (`docs/design/stitch-prompts.md`), and this pack. No application code yet.
- GitHub push from Claude sessions is blocked (403) until the Claude GitHub App is installed on `simpleHacker0893/basix-venture-route`.

## Next
1. Operator approves the pack (or gives changes).
2. Operator installs the Claude GitHub App; Architect pushes the branch and opens the pack PR.
3. Sprint 000 Builder starts from `planning/sprints/000-metta-spike/handoff-prompt.md` by Tue 2026-09-22 evening.
4. Operator runs Stitch batch 1 (5 screens) and commits exports under `design/stitch/batch-1/` by Thu 2026-09-24 18:00 EAT.

## Blockers
- GitHub App access (Operator).
- Anthropic API key, Clerk keys, Neon project (`DATABASE_URL`), Railway project: needed from Sprint 001 onward (see `QUESTIONS.md`).

## Scope floor (must be on screen on 1 Oct)
Chat/form intake · brief review chips · route result with gaps first · Why this route? drawer · five demo scenarios · Demo data labels · one launch command.
