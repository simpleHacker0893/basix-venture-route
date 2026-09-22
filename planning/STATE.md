# STATE — rolling snapshot (edit in place, never append a log)

**Updated:** 2026-09-22 (night) · **Demo:** Thu 2026-10-01 · **Current sprint:** 001 — Routing core: Architect verdict **DONE_WITH_FOLLOW_UPS** (`planning/sprints/001-routing-core/review.md`); PR #20 ready to merge. Next: 002 — Founder UI (planned, Fri 25 Sep 08:00)

## Where we are
- Sprint 000 merged into `master`: `services/engine` runs FastAPI with `hyperon==0.2.10` in-process; all seven named rules live in `seed/rules.metta` over 181 seed atoms; `GET /health` and dev-only `POST /internal/query` are up.
- Sprint 001 implemented on `sprint/001-routing-core` (tickets #11–#18 closed with RED/GREEN evidence; `/code-review master` applied three fixes: dated `currentBrief` serialised as JSON in the Anthropic adapter (#17), `demoData` on `PartialBrief` so a scenario round-trips as `currentBrief` (#11, #16), mypy strict over tests and scripts (#18)). The branch was cut from `origin/master` plus the D-25..D-28 docs commit `d1003de`, so the PR carries that commit too.
- Shipped: `packages/contracts` (Zod 4 schemas, generated `src/schema.json`, Vitest parity test against `services/engine/scripts/export_schema.py`); Pydantic mirrors `app/models/route.py`, `chat.py`; pure assembler `app/routing/assembler.py` with `assembler.team-size-fit` / `assembler.budget-fit` (D-22) and `next_actions.py`; `MettaRouteEngine.day_rates` and `known_entities`; `app/routing/route_service.py` (status per D-09, D-23 shapes, `rulesApplied`, template summary); `LlmAdapter` protocol, `NullAdapter`, `AnthropicAdapter` (official SDK 1.8, `claude-opus-5`, `output_config.format`, facts stripped from the explanation payload), adapter factory (NullAdapter whenever `ANTHROPIC_API_KEY` is unset); orchestrator with template clarification questions and the explanation boundary; `POST /api/route`, `GET /api/scenarios`, `POST /api/conversation`; validation errors answer `{type: validation-error}` with field-specific messages; project-wide `.env.example`; the engine reads the repo-root `.env` then `services/engine/.env`; `docs/API.md` documents every endpoint.
- Acceptance evidence (clean detached worktree at the PR head, no `.env`): 119 pytest, ruff, `uv run mypy .` (51 files), `export_schema.py --check`, 7 Vitest, `pnpm -r typecheck` all green; live uvicorn answered every HTTP line. The engine agreed with every DOMAIN.md scenario value; no seed was adjusted.
- Not done in Sprint 001: the Should line "real key → route in one turn" (#19; the `.env` on the Builder machine holds the placeholder key) and the Codespaces `docker compose up engine` check.
- Local git note: the `/code-review` run also merged the sprint branch into local `master` (`e08eaec`, `--no-ff`). That merge is **not pushed**; `origin/master` still gates on the PR per AGENTS.md steps 3–4. Reset local `master` to `origin/master` before merging the PR the normal way.
- Prompt 0 done: Matt Pocock skills configured (GitHub Issues tracker, `docs/agents/`), `CONTEXT.md` glossary, ADRs 0001–0009 under `docs/adr/`, labels `sprint:000`–`sprint:005` and `ready-for-agent`.
- Store decided: Neon Postgres (D-17). Builder prompts in `planning/PROMPTS.md`.
- Money is USD per day (D-16); status is a pure function of gaps and coverage (D-09, Q-01 closed by the Architect ruling); display names derive from IDs and day rates come from `day_rates(builder_ids)` (D-24). Integers on the wire stay within the JavaScript safe range on both sides of the contract.
- Web stack is React 19 + Vite (D-25). Keys arrive via `.env` only (D-26). Railway/Vercel commands are run by the Operator from `docs/DEPLOY.md` (D-27). Demo video via Playwright CLI; pitch deck as a Slides artifact with `docs/PITCH.md` (D-28).
- Docker is not run locally (Operator decision 2026-09-22): the engine image and `docker compose up engine` are verified on GitHub Codespaces. Local Windows needs the VC++ 2015–2022 runtime for the hyperon wheel (installed). Clean-checkout runs must live at a short path: a worktree under the Claude scratchpad hit the Windows 260-character limit and one SDK module failed to import.
- Knowledge graph: `.gitignore` allows `graphify-out/graph.json` and `GRAPH_REPORT.md`, but neither is committed yet (Architect review of `2c38d84`). Build it with `/graphify .` and commit it before relying on `/graphify query`.
- Stitch MCP is registered at user scope in Claude Code (`claude mcp get stitch` → Connected).

## What Sprint 002 inherits
- **Package**: `@venture-route/contracts` (`pnpm -F @venture-route/contracts build`; import `VentureBrief`, `PartialBrief`, `VentureRoute`, `ChatTurn`, `ChatResponse`, `Gap`, `ReasoningPath` and the enums `SkillId`, `Vertical`, `DeliveryMode`, `RouteStatus`, `EvidenceType`, `GapCategory`, `RuleName`). `src/schema.json` is the same contract as JSON Schema.
- **Endpoints** (engine at `VITE_API_URL`, default `http://localhost:8000`):
  - `GET /api/scenarios` → `VentureBrief[]`, seed order: `brief-health-01`, `brief-agri-01`, `brief-constrained-01`, `brief-budget-01`, `brief-onsite-01`; every brief has `demoData: true`. A scenario can be posted back unmodified as `currentBrief`.
  - `POST /api/route` body `VentureBrief` → `200 VentureRoute`; invalid input → `422 {type: "validation-error", message}` (field-specific, e.g. `"dailyBudget: Input should be greater than 0"`).
  - `POST /api/conversation` body `{userMessage, currentBrief?}` → `200 ChatResponse` discriminated by `type`: `clarification {missingFields, message, partialBrief}`, `route {brief, route, message}`, `validation-error {message}`. Malformed body → `422` with the validation-error shape. Never a 500 for a missing or failing LLM; the `message` then carries the form-fallback hint and the route equals the form path.
- **`VentureRoute` fields**: `status` (`feasible | partial | infeasible`), `builders[] {builderId, name, dayRate, covers[], evidenceType, evidencePaths[] {rule, facts[], conclusion}}`, `totalDailyRate`, `reusableIp {assetId, title, path} | null`, `cohort {cohortId, universityId, path} | null`, `partner {partnerId, path} | null`, `gaps[] {category, statement, affected[], nextActions[], rule}`, `rulesApplied[]`, `summary`. Infeasible routes have `builders: []` and null IP/cohort/partner (D-23); a budget-gap route has `builders: []` and one `assembler.budget-fit` gap (D-22). Render gaps above builder cards (AGENTS.md rule 6).
- **Clarification fields** come in PRD §5.3 order: `title, vertical, requiredSkills, maximumTeamSize, availabilityStart, availabilityEnd, deliveryMode, dailyBudget, preferReusableIp`, plus `location` when the mode is on-site. `maximumTeamSize` is 1–5.
- **Env**: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_OFFLINE_DEMO` are already in `.env.example`.
- **Q-12 closed by D-29**: the engine's two-action strings for `skill`/`availability`/`mode`/`location` gaps are canonical; the UI renders one button per `nextActions` entry.
- **Engine gaps Sprint 002 fixes first (review.md)**: no CORS (preflight 405) → D-30; offline snapshot generated → D-34; the placeholder `ANTHROPIC_API_KEY` must select `NullAdapter`. Technical view renders `ReasoningPath` only (D-31); PWA checked by Playwright, not Lighthouse (D-32); CI added (D-33).

## Next
1. Operator: reset local `master` to `origin/master`, merge PR #20, then merge the Architect planning PR (`claude/laughing-pascal-bs5cz8`). Full list in `planning/sprints/002-founder-ui/operator-checklist.md`.
2. Operator: Stitch batch 1 under `design/stitch/batch-1/` by Thu 24 Sep 18:00; batch 2 (2.1 Landing, 2.2 Handoff only) by Fri 25 Sep 18:00.
3. Sprint 002 P1 at Fri 25 Sep 08:00 on `sprint/002-founder-ui` from `origin/master` (prompts in `planning/PROMPTS.md` §Sprint 002).
4. Optional: #19 with a real `ANTHROPIC_API_KEY`; Codespaces `docker compose up engine` health check.
5. Operator, before Sat 26 Sep 20:00: Clerk application + session-token claim, Neon project with `dev`/`test` branches, all written into `.env` (operator-checklist.md §Clerk, §Neon).

## Blockers
- None for Sprint 002 (no keys needed; CI runs on `LLM_PROVIDER=null`).
- For Sprint 003 (due Sat 26 Sep 20:00): Clerk keys, JWKS URL, session-token `metadata` claim and webhook secret; Neon `DATABASE_URL`/`TEST_DATABASE_URL` in the asyncpg `?ssl=require` form.
- Team member names for the pitch deck and README (Q-08) — "at the end".

## Scope floor (must be on screen on 1 Oct)
Chat/form intake · brief review chips · route result with gaps first · Why this route? drawer · five demo scenarios · Demo data labels · one launch command.
