# STATE — rolling snapshot (edit in place, never append a log)

**Updated:** 2026-09-22 (night) · **Demo:** Thu 2026-10-01 · **Current sprint:** 001 — Routing core (implemented on `sprint/001-routing-core`; tickets #11–#18 closed with RED/GREEN evidence; awaiting `/code-review master`, acceptance evidence and the PR)

## Where we are
- Sprint 000 merged into `master`: `services/engine` runs FastAPI with `hyperon==0.2.10` in-process; all seven named rules live in `seed/rules.metta` over 181 seed atoms; `GET /health` and dev-only `POST /internal/query` are up.
- Sprint 001 implemented on `sprint/001-routing-core` (cut from `origin/master` plus the D-25..D-28 docs commit `d1003de`, which is not yet on `origin/master`). Shipped: `packages/contracts` (Zod 4 schemas, generated `src/schema.json`, Vitest parity test against `services/engine/scripts/export_schema.py`); Pydantic mirrors `app/models/route.py`, `chat.py`; pure assembler `app/routing/assembler.py` with `assembler.team-size-fit` / `assembler.budget-fit` (D-22) and `next_actions.py`; `MettaRouteEngine.day_rates` and `known_entities`; `app/routing/route_service.py` (status per D-09, D-23 shapes, `rulesApplied`, template summary); `LlmAdapter` protocol, `NullAdapter`, `AnthropicAdapter` (official SDK 1.8, `claude-opus-5`, `output_config.format`, facts stripped from the explanation payload), adapter factory (NullAdapter whenever `ANTHROPIC_API_KEY` is unset); orchestrator with template clarification questions and the explanation boundary; `POST /api/route`, `GET /api/scenarios`, `POST /api/conversation`; validation errors answer `{type: validation-error}` with field-specific messages; `.env.example` gains `LLM_PROVIDER` and `ANTHROPIC_API_KEY`; `docs/API.md` documents every endpoint.
- Evidence: 118 pytest (all five DOMAIN.md scenarios exact over both HTTP paths, byte-identical route between form and chat), 7 Vitest, ruff, mypy strict and `pnpm -r typecheck` green on Windows. The engine agreed with every expected scenario value; no seed was adjusted.
- Not done in Sprint 001 yet: the Should line "real key → route in one turn" (no `.env` on the Builder machine; D-26), the Codespaces `docker compose up engine` check, and `/code-review master` (Operator-invoked skill).
- Prompt 0 done: Matt Pocock skills configured (GitHub Issues tracker, `docs/agents/`), `CONTEXT.md` glossary, ADRs 0001–0009 under `docs/adr/`, labels `sprint:000`–`sprint:005` and `ready-for-agent`.
- Store decided: Neon Postgres (D-17). Builder prompts in `planning/PROMPTS.md`.
- Money is USD per day (D-16); status is a pure function of gaps and coverage (D-09, Q-01 closed by the Architect ruling); display names derive from IDs and day rates come from `day_rates(builder_ids)` (D-24). Integers on the wire stay within the JavaScript safe range on both sides of the contract.
- Web stack is React 19 + Vite (D-25). Keys arrive via `.env` only (D-26). Railway/Vercel commands are run by the Operator from `docs/DEPLOY.md` (D-27). Demo video via Playwright CLI; pitch deck as a Slides artifact with `docs/PITCH.md` (D-28).
- Docker is not run locally (Operator decision 2026-09-22): the engine image and `docker compose up engine` are verified on GitHub Codespaces. Local Windows needs the VC++ 2015–2022 runtime for the hyperon wheel (installed).
- Knowledge graph: `graphify-out/graph.json` and `GRAPH_REPORT.md` are committed; `/graphify query "<question>"` answers codebase questions from it. Rebuild with `/graphify . --update` after a sprint merges.
- Stitch MCP is registered at user scope in Claude Code (`claude mcp get stitch` → Connected).

## Next
1. Operator pastes P4 (`/code-review master`) in the Sprint 001 session, then P5 (acceptance evidence, this file, PR "Sprint 001: Routing core").
2. Operator places `ANTHROPIC_API_KEY` in `.env` (D-26), then the Should line: `uv run uvicorn app.main:app` and POST the Health pilot message to `/api/conversation`; paste the `type: route` output into the PR.
3. Codespaces check: `docker compose up engine` then `curl localhost:8000/health` shows `rules_loaded == 7`; paste into the Sprint 001 PR.
4. Architect: answer Q-12 (next-action wording for `skill`/`availability`/`mode`/`location` gaps) before Sprint 002 renders gap panels.
5. Operator runs Stitch batch 1 (5 screens) and commits exports under `design/stitch/batch-1/` by Thu 2026-09-24 18:00 EAT.
6. Sprint 002 inherits: `@venture-route/contracts` (import the Zod schemas; `VentureRoute.reusableIp`/`cohort`/`partner` are `null` when absent), `GET /api/scenarios` for preload, `POST /api/conversation` returning `ChatResponse` with `type` discriminator, validation errors as `422 {type: validation-error, message}`.

## Blockers
- `.env` values still to be delivered by the Operator: `ANTHROPIC_API_KEY` (Sprint 001 Should line only), Clerk keys and webhook secret (Sprint 003), Neon `DATABASE_URL` (Sprint 003).
- Team member names for the pitch deck and README (Q-08) — "at the end".

## Scope floor (must be on screen on 1 Oct)
Chat/form intake · brief review chips · route result with gaps first · Why this route? drawer · five demo scenarios · Demo data labels · one launch command.
