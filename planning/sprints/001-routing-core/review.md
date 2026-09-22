# Sprint 001 — Architect Builder Review

**PR:** https://github.com/simpleHacker0893/basix-venture-route/pull/20 · **Head reviewed:** `2c38d84` (report evidence was at `bda1e11`; the only later commit is STATE.md) · **Date:** 2026-09-22 · **Reviewer:** Architect

## Verdict: DONE_WITH_FOLLOW_UPS

All 14 Must lines reproduce from a clean detached worktree on Linux (Python 3.12, `uv sync`, `pnpm install --frozen-lockfile`, no `.env`). The one ❌ is a Should line with named follow-up #19, which AUTOMATION.md allows. The Operator may merge after resetting local `master` (see `planning/sprints/002-founder-ui/operator-checklist.md` row 1).

## Re-run evidence (Architect session, Linux)
```
$ uv run pytest -q -p no:cacheprovider
119 passed, 1 warning in 66.49s
$ uv run ruff check . ; uv run ruff format --check .
All checks passed!
51 files already formatted
$ uv run mypy .
Success: no issues found in 51 source files
$ uv run python scripts/export_schema.py --check
…/packages/contracts/src/schema.json is up to date
$ pnpm -r test
 Test Files  1 passed (1)
      Tests  7 passed (7)
$ pnpm -r typecheck
> tsc -p tsconfig.json --noEmit     (no errors)
```
Live `uvicorn` with `LLM_PROVIDER=null`:
```
GET /health  {"status":"ok","facts_loaded":181,"rules_loaded":7,"hyperon_version":"0.2.10","demo_today":"2026-09-22"}
constrained  partial [('skill', ['mobile'], ['Ask BASIX to confirm a credential or project for mobile.', 'Remove mobile from the brief or replace it with a related skill.'])]
health       partner-fit, 4 facts: (supports-vertical amani-health health) (partners-with amani-health omni-university) (cohort-of cohort-2026a omni-university) (belongs-to amina-otieno cohort-2026a)
health@250   partial [('budget', ['Raise daily budget to USD 370'])]
OPTIONS /api/route  Origin: http://localhost:5173  → HTTP/1.1 405 Method Not Allowed
```

## Line by line
| Line | Report | Architect | Note |
|---|---|---|---|
| Must 1–14 | ✅ | ✅ | Reproduced. The Windows `python -m pytest` workaround is irrelevant on Linux. |
| Should: real key, one-turn route | ❌ (#19) | ❌, accepted | Follow-up #19. The Operator supplies the key (D-26). |
| Should: `GET /api/scenarios` | ✅ | ✅ | Five ids in seed order. |

## Deviations: accepted
- `assemble(tuples, day_rates, brief) -> Assembly`, with the route service building `VentureRoute`. This keeps the assembler pure, in line with D-24. Accepted.
- The route and conversation endpoints are split into two modules. Accepted.
- `ReusableIp.title` is derived from the id by the presenter. Accepted, consistent with D-24.
- On the chat path, on-site without a location → clarification, while the form path gives 422. Accepted; it matches the form/chat split in PRD §5.3.
- A refusal raises `LlmUnavailable` → NullAdapter fallback. Accepted.

## Findings carried forward
1. **The engine sends no CORS headers** (the preflight answers 405). A browser on `:5173`/`:4173` or on Vercel cannot call it. **Sprint 002 ticket 1**, D-30.
2. **Q-12 is closed by D-29.** The engine's two-action strings are canonical. The draft Sprint 002 acceptance said "one next action button" for the Constrained brief, but the engine emits two. That acceptance line is corrected.
3. **The Sprint 002 draft asked for `route.debug`**, which does not exist, and for a **Lighthouse PWA installable** check, which Lighthouse 12 removed. Superseded by D-31 and D-32.
4. **PR #20 has no CI checks.** No `.github/workflows` exists, and the evidence came from a Windows machine with two environment traps. D-33 adds CI in Sprint 002.
5. **A verbatim copy of `.env.example` selects `AnthropicAdapter` with the placeholder key**, so every turn makes a doomed 401 call before falling back. Sprint 002 ticket 1 treats the placeholder as unset.
6. **STATE.md claimed `graphify-out/graph.json` and `GRAPH_REPORT.md` are committed.** They are not in the tree at `2c38d84` (only the `.gitignore` allow-rules are). Corrected in STATE.md.
7. **Sprint 003 risk:** the `.env.example` `DATABASE_URL` uses `?sslmode=require` with `postgresql+asyncpg`. The asyncpg driver behind SQLAlchemy does not take `sslmode`/`channel_binding`. The Sprint 003 first ticket must prove a Neon connection and fix the example. The Operator checklist gives the `?ssl=require` form.
8. The TIMELINE G3 row still said "Convex → graph reprojection". Corrected to Postgres (D-17).

## Operator actions before merge
Reset local `master` to `origin/master`, then merge #20. Optionally close #19 and paste the Codespaces `docker compose up engine` health check.
