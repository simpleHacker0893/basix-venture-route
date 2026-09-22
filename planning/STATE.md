# STATE — rolling snapshot (edit in place, never append a log)

**Updated:** 2026-09-22 · **Demo:** Thu 2026-10-01 · **Current sprint:** 001 — Routing core (ready to start; Architect review of 000 = DONE)

## Where we are
- Sprint 000 implemented on `sprint/000-metta-spike` (issues #1–#6 closed with RED/GREEN evidence). `services/engine` runs FastAPI with `hyperon==0.2.10` in-process; all seven named rules live in `seed/rules.metta` over 186 seed atoms; `MettaRouteEngine` exposes `eligible_builders`, `reuse_candidates`, `partner_candidates`, `cohort_of`, `gaps` with typed `ReasoningPath`s; `GET /health` and dev-only `POST /internal/query` are up. 30 runtime tests, ruff and mypy strict green on Windows.
- Prompt 0 done: Matt Pocock skills configured (GitHub Issues tracker, `docs/agents/`), `CONTEXT.md` glossary, ADRs 0001–0009 under `docs/adr/`, labels `sprint:000`–`sprint:005` and `ready-for-agent`.
- Store decided: Neon Postgres (D-17). Builder prompts in `planning/PROMPTS.md`.
- Pack (PR #7) and Sprint 000 (PR #8) are merged into `master`; Sprint 001 branches from `origin/master`.
- Docker is not run locally (Operator decision 2026-09-22): the engine image and `docker compose up engine` are verified on GitHub Codespaces. Local Windows needs the VC++ 2015–2022 runtime for the hyperon wheel (installed).

## Next
1. Sprint 000 Architect review DONE on master (35 tests, ruff, mypy green in the Architect session; 181 seed atoms; 7 rules). Q-10/Q-11 ratified as D-20/D-21; D-22/D-23 fix the Budget and Delivery-mode scenario shapes; Sprint 001 acceptance carries exact expected teams and totals.
2. Codespaces check: `docker compose up engine` then `curl localhost:8000/health` shows `rules_loaded == 7`; paste into the PR.
3. Sprint 001 Builder starts from `planning/sprints/001-routing-core/handoff-prompt.md` (Wed 23 Sep 12:00 EAT). Inherits: `EligibleTuple`, `ReuseCandidate`, `PartnerCandidate`, `CohortInfo`, `Gap` in `app/models/engine.py`; brief facts are added to the space per query under a lock (`MettaRouteEngine._brief_in_space`); `partner_candidates` returns one candidate per selected builder, so the assembler picks the partner of the first selected builder.
4. Operator runs Stitch batch 1 (5 screens) and commits exports under `design/stitch/batch-1/` by Thu 2026-09-24 18:00 EAT.

## Blockers
- Anthropic API key, Clerk keys, Neon project (`DATABASE_URL`), Railway project: needed from Sprint 001 onward (see `QUESTIONS.md`).
- Q-01 (deterministic status, D-09) still awaits the Operator's one-word confirmation before Sprint 001.

## Scope floor (must be on screen on 1 Oct)
Chat/form intake · brief review chips · route result with gaps first · Why this route? drawer · five demo scenarios · Demo data labels · one launch command.
