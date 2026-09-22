# Sprint 000 — MeTTa spike

**Window:** Tue 22 Sep 18:00 → Wed 23 Sep 12:00 EAT (half-day Builder box, D-11). **Branch:** `sprint/000-metta-spike`.

## Goal
Prove, in this repo and through FastAPI, that the official Hyperon runtime loads BASIX-shaped facts, executes named multi-hop rules, and returns typed JSON that a contract test can verify. Retire risk R-02 before any UI work.

## User story
As a reviewer, I want a real-runtime integration test so that the graph engine cannot be silently replaced by a hardcoded matcher.

## In scope
1. Monorepo skeleton: `services/engine` (uv, Python 3.12, FastAPI), `packages/contracts` (placeholder), root `turbo.json`, `.python-version`, `.env.example`, `docker-compose.yml` with the `engine` service only.
2. `services/engine/seed/facts.metta`: the full demo graph from `planning/DOMAIN.md` scenarios: 14 builders, 9 skills, 10 credentials, 5 IP assets (3 licensable), 3 cohorts + 3 universities, 4 partners, `partners-with` edges, availability intervals relative to `DEMO_TODAY=2026-09-22`, all fictional, IDs kebab-case.
3. `services/engine/seed/rules.metta`: `verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`, `reuse-fit`, `partner-fit`, `route-gap` as named MeTTa functions with the semantics in DOMAIN.md. Date overlap may be computed by a Python-grounded atom registered into the space (allowed), but the rule that combines the predicates must be MeTTa.
4. `MettaRouteEngine` adapter (`services/engine/app/engine/metta_engine.py`): loads facts + rules once; methods `eligible_builders(brief) -> list[EligibleTuple]`, `reuse_candidates(brief)`, `partner_candidates(brief, builder_ids)`, `cohort_of(builder_id)`, `gaps(brief)`; each returns typed Pydantic models with `ReasoningPath` (rule, ordered facts, conclusion). Raises `EngineError` on unparseable output.
5. `GET /health` and `POST /internal/query` (dev-only, disabled unless `ENGINE_DEV_QUERY=1`) returning the typed tuples for a seed brief.
6. Contract test `tests/test_runtime_contract.py` marked `@pytest.mark.runtime`: real hyperon, loads the fixture, runs `eligible-builder` and `partner-fit` for the Health brief, asserts the four-hop partner path and the `both` evidence for `amina-otieno`/`python`, fails if hyperon is missing.

## Out of scope
Conversation API, LLM, assembler, web app, Convex, Clerk.

## Business rules
All from DOMAIN.md. `MIN_OVERLAP_DAYS = 2`. Self-described skills present in facts and provably ignored by `verified-for-skill` (test asserts it).

## Inputs / outputs
Input: seed brief `brief-health-01` as a Pydantic `VentureBrief`. Output: JSON matching `EligibleTuple[]`, `ReasoningPath` objects.

## Edge cases the fixture must contain
A builder with only a self-described skill (never eligible). A builder verified but unavailable (route-gap availability). A builder verified and available but remote-only for a hybrid brief... note: `hybrid` accepts `remote` and `hybrid` supporters; `on-site` requires `on-site` support plus location match (record this reading in tests). A licensable asset in the wrong vertical (not a reuse fit).
