# Sprint 001 — Routing core

**Window:** Wed 23 Sep 12:00 → Thu 24 Sep 20:00 EAT. **Branch:** `sprint/001-routing-core`. **Depends on:** Sprint 000 merged.

## Goal
Ship the end-to-end seam `POST /api/conversation` (PRD §5.2): message in, one of clarification / route / validation-error out, with the deterministic assembler, the LLM intake and explanation adapters, the structured-form fallback, and shared Zod + Pydantic contracts.

## User stories
1. As a founder, I describe my MVP in my own words and get asked only for what is missing.
2. As a founder, I get the smallest team covering my skills within team size and budget, each builder with evidence.
3. As a founder, I get a named gap with engine-supplied next actions when a constraint cannot be met.
4. As a frontend developer, I get a stable `VentureRoute` response and never parse MeTTa output.
5. As a founder without network or LLM access, I submit the structured form and get the identical route.

## In scope
1. `packages/contracts`: Zod schemas `VentureBrief`, `VentureRoute`, `ChatTurn`, `ChatResponse`, `ReasoningPath`, `Gap`; exported JSON Schema; a Vitest that the JSON Schema equals the one exported from Pydantic (`services/engine/scripts/export_schema.py`).
2. Pydantic mirrors with validators: non-empty `requiredSkills` from the seed skill list; `maximumTeamSize` 1–5; ISO dates, `availabilityEnd >= availabilityStart`; `location` required iff `deliveryMode == on-site`; `dailyBudget > 0`.
3. Route service `app/routing/route_service.py`: calls the Sprint 000 engine, runs the assembler (DOMAIN.md §Team assembly), computes status (D-09), builds `VentureRoute` including `rulesApplied` and per-entity paths.
4. Assembler `app/routing/assembler.py`: exhaustive subsets up to `maximumTeamSize` (≤ 5), ordering rule, `team-size` and `budget` gaps with rule names `assembler.team-size-fit` / `assembler.budget-fit`, next actions from a fixed table (`app/routing/next_actions.py`).
5. LLM adapters (`app/llm/`): `LlmAdapter` protocol; `AnthropicAdapter` using the `anthropic` SDK, model `claude-opus-5`, `output_config.format` with the brief-extraction schema (all fields optional), server-side key from `ANTHROPIC_API_KEY`; `explain_route(route) -> str` with the verbatim DOMAIN.md system instruction; `NullAdapter` used when the key is absent (returns fixed strings).
6. Conversation orchestrator `app/conversation/orchestrator.py`: merge `currentBrief` with extraction (latest explicit correction wins), compute `missingFields`, return `clarification` with a templated question per missing field, or validate and route.
7. `POST /api/conversation` and `POST /api/route` (form path: full brief in, route out, no LLM). Both return the same `VentureRoute` for the same brief.
8. Seed scenarios as pytest parametrised cases with expected status, team, gaps.
9. `.env.example` gains `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic|null`.

## Out of scope
Any UI. Postgres. Clerk. Persistence of briefs (Sprint 004 stores them with requests).

## Business rules
DOMAIN.md and D-08, D-09. Next-action table:
| Gap | Next actions |
|---|---|
| skill | "Remove <skill> from required skills"; "Extend the window to include <earliest verified builder's start>" when a verified-but-unavailable builder exists |
| availability | "Extend the window to include <date>" |
| mode / location | "Change delivery mode to <mode supported by a verified builder>"; "Change location to <location of a verified builder>" |
| team-size | "Raise maximum team size to <smallest covering subset size>" |
| budget | "Raise daily budget to <cheapest covering subset total>" |

## Edge cases
Vague message with zero extractable fields → clarification listing all required fields. Message that contradicts `currentBrief` → new value wins. `on-site` without location → validation-error, never a route. Budget below every covering subset → `partial` with `budget` gap and the cheapest subset listed in `affected`. LLM timeout or 5xx → fall back to `NullAdapter` behaviour and set `message` to the form-fallback hint; never a 500 to the client.
