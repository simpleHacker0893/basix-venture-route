# Sprint 001 — blueprint

## Files
```
packages/contracts/package.json, src/index.ts, src/brief.ts, src/route.ts, src/chat.ts, src/schema.json (generated), test/schema-parity.test.ts
services/engine/scripts/export_schema.py
services/engine/app/models/route.py          # VentureRoute, RouteBuilder, Gap, RouteStatus
services/engine/app/models/chat.py           # ChatTurn, ChatResponse (discriminated union on `type`)
services/engine/app/routing/assembler.py
services/engine/app/routing/next_actions.py
services/engine/app/routing/route_service.py
services/engine/app/llm/base.py              # LlmAdapter protocol, ExtractedBrief (all-optional)
services/engine/app/llm/anthropic_adapter.py
services/engine/app/llm/null_adapter.py
services/engine/app/conversation/orchestrator.py
services/engine/app/api/conversation.py      # POST /api/conversation, POST /api/route
services/engine/tests/test_assembler.py, test_route_service_scenarios.py, test_conversation_api.py, test_llm_boundary.py, test_schemas.py
```

## Steps
1. Contracts first (Zod), export JSON Schema, then Pydantic mirrors, then the parity test. This is the seam every later sprint depends on.
2. Assembler with pure functions and table-driven tests: coverage, ordering (fewer people → cost → evidence → id), team-size gap, budget gap.
3. Route service wiring engine → assembler → `VentureRoute`; `rulesApplied` is the sorted set of rule names present in any path or gap.
4. Anthropic adapter: `client.messages.parse` / `output_config.format` with the `ExtractedBrief` schema; `max_tokens` 4096; `thinking` adaptive default; timeout 20 s; retries 2; on any `APIError` raise `LlmUnavailable`. Explanation call receives **only** `route.model_dump()`; the test asserts the request payload contains no `earned`/`built` atoms and no builder not already in the route.
5. Orchestrator: merge → missing → clarify-or-route. Clarification questions are template strings keyed by field, not LLM output.
6. API routes with FastAPI dependency for the engine singleton; `POST /api/route` shares the route service.
7. Scenario tests: the five DOMAIN.md scenarios with exact expected teams and gaps; also the form path equality test (`/api/route` == `/api/conversation` route for the same brief with `NullAdapter`).
8. Boundary test: with `NullAdapter`, every response type reachable; with a fake adapter that returns an out-of-route builder name in its explanation, the presenter strips or rejects it (choose reject: replace with the deterministic template summary and log a warning).

## Interfaces consumed by Sprint 002
`POST /api/conversation` `{userMessage, currentBrief?}` → `ChatResponse`. `POST /api/route` `VentureBrief` → `VentureRoute`. `GET /api/scenarios` → the five seed briefs (add this small endpoint here so the UI can preload).

## Testing plan
`uv run pytest -q` (unit + runtime), `pnpm -F @venture-route/contracts test`, ruff, mypy, `pnpm -r typecheck`.
