# Sprint 001 — acceptance

## Must
- [ ] `POST /api/conversation` with "I want to build something for farmers" returns `type: clarification` listing every required field, no route.
- [ ] Validation errors: invalid mode, non-positive budget, unsupported vertical, `on-site` without location each return `type: validation-error` with a field-specific message.
- [ ] Health pilot → `feasible`, 3 builders, `totalDailyRate == 370`, reusable IP present, cohort present, partner `amani-health` with a 4-fact path.
- [ ] Agri marketplace → `feasible` with a team disjoint from the Health team, agri IP, agri partner.
- [ ] Constrained brief → `partial`, one gap `{category: skill, affected: [mobile]}` with rule `route-gap`, rust builder in `builders`, no builder fabricated for mobile.
- [ ] Budget challenge (USD 250) → `partial` with a `budget` gap naming `assembler.budget-fit` and the cheapest covering total in the statement, or a cheaper feasible team if and only if the seed supports one (test asserts whichever the seed implies and documents it).
- [ ] Delivery-mode challenge (on-site Kisumu) → `partial` with `location` gaps for the affected skills.
- [ ] Self-described skill never yields a builder; evidence labels `credential`/`project`/`both` match the fixture.
- [ ] Selection respects team size and budget with the ordering in DOMAIN.md (table-driven test with ≥ 6 cases).
- [ ] `POST /api/route` (form path) returns a byte-identical `route` object to `POST /api/conversation` for the same confirmed brief with `LLM_PROVIDER=null`.
- [ ] LLM boundary test: the explanation request payload contains no raw facts and no entity outside the route; an explanation naming an outside entity is replaced by the template summary.
- [ ] With `ANTHROPIC_API_KEY` unset the API still serves clarification/route/validation using `NullAdapter`; no 500s.
- [ ] Zod JSON Schema equals Pydantic JSON Schema (parity test green).
- [ ] `uv run pytest -q`, ruff, mypy, `pnpm -r test`, `pnpm -r typecheck` all green; `STATE.md` updated.

## Should
- [ ] With a real key, the Health pilot message yields a `route` response in one turn when the message contains all fields (manual run, output pasted).
- [ ] `GET /api/scenarios` returns the five briefs.
