# @venture-route/contracts

Zod schemas for the wire contract between the FastAPI engine and the web app (PRD §5.2–5.4):
`VentureBrief`, `PartialBrief`, `VentureRoute`, `ReasoningPath`, `Gap`, `ChatTurn`, `ChatResponse`.

`src/schema.json` is **generated** from the Pydantic mirrors in `services/engine/app/models/` by

```bash
cd services/engine && uv run python scripts/export_schema.py        # rewrite
cd services/engine && uv run python scripts/export_schema.py --check  # CI freshness check
```

`test/schema-parity.test.ts` renders every Zod schema to JSON Schema and requires it to equal the
export, after both sides apply the same canonical form (refs inlined, `title`/`description`
dropped, `required` sorted, `type: [T, "null"]` written as `anyOf`). Change a field on either side
and the test fails until the other side follows.

Conventions carried by the schemas: money is integer USD per day (D-16); dates are ISO
date-only strings; IDs are kebab-case slugs; `maximumTeamSize` is 1–5; `location` is required
when `deliveryMode` is `on-site` (enforced by the engine validator); integers stay within the
JavaScript safe range on both sides.

```bash
pnpm -F @venture-route/contracts test
pnpm -F @venture-route/contracts typecheck
```
