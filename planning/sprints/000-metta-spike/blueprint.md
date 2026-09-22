# Sprint 000 — blueprint

## Files to create
```
.python-version                      # 3.12
.env.example                         # DEMO_TODAY, ENGINE_DEV_QUERY, ENGINE_PORT
turbo.json, package.json             # pnpm workspaces: apps/*, packages/*
docker-compose.yml                   # engine service, build ./services/engine
services/engine/pyproject.toml       # uv; deps: fastapi, uvicorn, pydantic>=2, hyperon==0.2.10; dev: pytest, ruff, mypy, httpx
services/engine/Dockerfile           # python:3.12-slim, uv sync, uvicorn app.main:app
services/engine/app/main.py          # FastAPI app, lifespan loads engine once
services/engine/app/config.py        # Settings (pydantic-settings): DEMO_TODAY, MIN_OVERLAP_DAYS=2, ENGINE_DEV_QUERY
services/engine/app/models/brief.py  # VentureBrief (PRD §5.3) with validators
services/engine/app/models/engine.py # EligibleTuple, ReasoningPath, Gap, EvidenceType, RuleName enum
services/engine/app/engine/metta_engine.py
services/engine/app/engine/grounded.py   # Python-grounded atoms: date-overlap-days, str/num helpers
services/engine/seed/facts.metta
services/engine/seed/rules.metta
services/engine/seed/briefs.json     # five scenario briefs
services/engine/tests/conftest.py    # engine fixture (session scope)
services/engine/tests/test_runtime_contract.py
services/engine/tests/test_rules_semantics.py
packages/contracts/README.md         # placeholder; filled in Sprint 001
```

## Steps
1. Scaffold the monorepo and `services/engine` with uv; `uv run pytest -q` runs zero tests green.
2. Write `facts.metta` from DOMAIN.md scenarios. Keep every fact on one line, `(predicate subject object …)`. Add a `; demo-data` header comment.
3. Write `grounded.py`: register `overlap-days` as a grounded operation returning an integer for two ISO date pairs. Register once at engine init.
4. Write `rules.metta`. Pattern per rule: `(= (rule-name $args…) (let* ((bindings via match &self …)) result))`. `verified-for-skill` returns `(credential $c)` / `(project $p)` witnesses; the adapter folds duplicates into `both`.
5. Write `MettaRouteEngine`: `MeTTa()` instance, `run` facts then rules, a `_query(expr) -> list[Atom]` helper, per-rule parsers to Pydantic. Every parser builds the `ReasoningPath.facts` list by re-querying the concrete facts that matched (ordered as in DOMAIN.md), so the UI can show them.
6. `GET /health` returns `{status, facts_loaded, rules_loaded, hyperon_version}`.
7. `POST /internal/query` (dev only) accepts `{briefId}` and returns `eligible`, `reuse`, `partners`, `gaps`.
8. Contract test: assert hyperon importable; assert `eligible_builders(health)` contains `(amina-otieno, python, both)`; assert `partner_candidates(health, [amina-otieno])` returns `amani-health` with a path of exactly four facts in the order supports-vertical, partners-with, cohort-of, belongs-to; assert self-described builder absent; assert `gaps(constrained)` yields `skill` for `mobile`.
9. Semantics test (also real runtime, not mocked): mode/location cases, overlap threshold at 1 vs 2 days, wrong-vertical asset.
10. `docker compose up engine` serves `/health`.

## Testing plan
`uv run pytest -q -m runtime` and `uv run pytest -q` both green; `uv run ruff check .`; `uv run mypy app`. Docker build succeeds.

## Interfaces (Sprint 001 consumes these)
```python
class EligibleTuple(BaseModel): builder_id: str; skill_id: str; evidence: EvidenceType; path: ReasoningPath
class ReasoningPath(BaseModel): rule: str; facts: list[str]; conclusion: str
class Gap(BaseModel): category: Literal[...]; statement: str; affected: list[str]; next_actions: list[str]; rule: str
class MettaRouteEngine: eligible_builders(brief) ; reuse_candidates(brief) ; partner_candidates(brief, builder_ids) ; cohort_of(builder_id) ; gaps(brief)
```
