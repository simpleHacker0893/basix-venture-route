# Sprint 001 — acceptance

## Must
- [ ] `POST /api/conversation` with "I want to build something for farmers" returns `type: clarification` listing every required field, no route.
- [ ] Validation errors: invalid mode, non-positive budget, unsupported vertical, `on-site` without location each return `type: validation-error` with a field-specific message.
- [ ] Health pilot → `feasible`; builders exactly amina-otieno, daniel-kiptoo, grace-wambui with evidence both/both/credential; `totalDailyRate == 370`; `reusableIp.assetId == asset-afya-triage`; cohort of amina-otieno; partner `amani-health` with a 4-fact path.
- [ ] Agri marketplace → `feasible`; builders exactly wanjiru-mwangi, lucy-achieng, fatuma-hassan; `totalDailyRate == 315` (brian-odhiambo not chosen: cost ordering beats evidence ordering); `reusableIp.assetId == asset-shamba-records`; partner `shamba-agri`.
- [ ] Constrained brief → `partial`; one gap `{category: skill, affected: [mobile], rule: route-gap}`; builders exactly zawadi-njoroge (rust, credential), `totalDailyRate == 130`; no IP, no partner; no builder fabricated for mobile.
- [ ] Budget challenge (USD 250) → `partial`; `builders == []`; one gap `{category: budget, rule: assembler.budget-fit, affected: [amina-otieno, daniel-kiptoo, grace-wambui]}` whose statement contains 370 and 250 and whose nextActions is exactly ["Raise daily budget to USD 370"] (D-22).
- [ ] Delivery-mode challenge (on-site Kisumu) → `infeasible`; three gaps `{category: location, rule: route-gap}` for python, ai-metta, ui-ux; `builders == []`; no `reusableIp`, `cohort` or `partner` (D-23).
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
