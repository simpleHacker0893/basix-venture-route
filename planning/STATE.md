# STATE — rolling snapshot (edit in place, never append a log)

**Updated:** 2026-09-22 (evening) · **Demo:** Thu 2026-10-01 · **Current sprint:** 001 — Routing core (ready to start; Architect review of 000 = DONE; D-24..D-28 merged; Sprint 001 tickets published)

## Where we are
- Sprint 000 implemented on `sprint/000-metta-spike` (issues #1–#6 closed with RED/GREEN evidence). `services/engine` runs FastAPI with `hyperon==0.2.10` in-process; all seven named rules live in `seed/rules.metta` over 181 seed atoms; `MettaRouteEngine` exposes `eligible_builders`, `reuse_candidates`, `partner_candidates`, `cohort_of`, `gaps` with typed `ReasoningPath`s; `GET /health` and dev-only `POST /internal/query` are up. 35 tests, ruff and mypy strict green on Windows.
- Prompt 0 done: Matt Pocock skills configured (GitHub Issues tracker, `docs/agents/`), `CONTEXT.md` glossary, ADRs 0001–0009 under `docs/adr/`, labels `sprint:000`–`sprint:005` and `ready-for-agent`.
- Store decided: Neon Postgres (D-17). Builder prompts in `planning/PROMPTS.md`.
- Pack (PR #7), Sprint 000 (PR #8), D-20..D-23 (PR #9), D-24 (PR #10) and D-25..D-28 are merged into `master`; Sprint 001 branches from `origin/master`.
- Money is USD per day (D-16); status is a pure function of gaps and coverage (D-09, Q-01 closed by the Architect ruling); display names derive from IDs and day rates come from `day_rates(builder_ids)` (D-24).
- Web stack is React 19 + Vite (D-25). Keys arrive via `.env` only (D-26). Railway/Vercel commands are run by the Operator from `docs/DEPLOY.md` (D-27). Demo video via Playwright CLI; pitch deck as a Slides artifact with `docs/PITCH.md` (D-28).
- Docker is not run locally (Operator decision 2026-09-22): the engine image and `docker compose up engine` are verified on GitHub Codespaces. Local Windows needs the VC++ 2015–2022 runtime for the hyperon wheel (installed).
- Knowledge graph: `graphify-out/graph.json` and `GRAPH_REPORT.md` are committed; `/graphify query "<question>"` answers codebase questions from it. Rebuild with `/graphify . --update` after a sprint merges.
- Stitch MCP is registered at user scope in Claude Code (`claude mcp get stitch` → Connected).

## Next
1. Sprint 001 Builder works the eight `sprint:001` tickets in dependency order (contracts → assembler → route service → adapters/orchestrator → `/api/route` + `/api/scenarios` → `/api/conversation` → AnthropicAdapter → scenario tests) on `sprint/001-routing-core` cut from `origin/master`. Inherits: `EligibleTuple`, `ReuseCandidate`, `PartnerCandidate`, `CohortInfo`, `Gap` in `app/models/engine.py`; brief facts are added to the space per query under a lock (`MettaRouteEngine._brief_in_space`); `partner_candidates` returns one candidate per selected builder, so the assembler picks the partner of the first selected builder.
2. Codespaces check: `docker compose up engine` then `curl localhost:8000/health` shows `rules_loaded == 7`; paste into the Sprint 001 PR.
3. Operator runs Stitch batch 1 (5 screens) and commits exports under `design/stitch/batch-1/` by Thu 2026-09-24 18:00 EAT.
4. Operator places `ANTHROPIC_API_KEY` in `.env` before the Sprint 001 "Should" line that needs a real key (D-26).

## Blockers
- `.env` values still to be delivered by the Operator: Clerk keys and webhook secret (Sprint 003), Neon `DATABASE_URL` (Sprint 003). Not blockers for Sprint 001.
- Team member names for the pitch deck and README (Q-08) — "at the end".

## Scope floor (must be on screen on 1 Oct)
Chat/form intake · brief review chips · route result with gaps first · Why this route? drawer · five demo scenarios · Demo data labels · one launch command.
