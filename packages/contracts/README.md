# @venture-route/contracts

Zod schemas for the wire contract between the FastAPI engine and the web app. The browser
imports every request and response type from this package and Zod-parses every engine response,
so it never sees an unparsed route and never parses MeTTa output.

| Module | Schemas | Engine mirror |
|---|---|---|
| `src/brief.ts` | `VentureBrief`, `PartialBrief`, `SkillId`, `Vertical`, `DeliveryMode`, `IsoDate`, `DailyBudget` (PRD §5.3) | `app/models/brief.py` |
| `src/route.ts` | `VentureRoute`, `RouteBuilder`, `ReusableIp`, `RouteCohort`, `RoutePartner`, `Gap`, `ReasoningPath` (PRD §5.4) | `app/models/route.py`, `app/models/engine.py` |
| `src/chat.ts` | `ChatTurn`, `ChatResponse` (`clarification | route | validation-error`), `ValidationErrorResponse` (PRD §5.2) | `app/models/chat.py` |
| `src/marketplace.ts` | `RoleChoice`, `RoleResponse`, `ProfileInput`, `BuilderProfile`, `ProfileSkill`, `CredentialInput`, `Credential`, `ProjectInput`, `Project`, `PendingQueue`, `AdminDecision`, `Candidate`, `SharedContact` (Sprint 003); `RequestCreate`, `Request`, `RouteSnapshot`, `Eligibility`, `BidCreate`, `Bid`, `BookingProposal`, `BookingCreate`, `Booking`, `BookingHistoryEntry`, `Dashboard`, `DashboardCounts`, `RouteCounts` and the literal unions `RequestStatus`, `BidStatus`, `BookingState`, `BookingAction`, `BookingActor`, `DurationMin` (Sprint 004) | `app/marketplace/schemas.py` |

`src/schema.json` is **generated** from the Pydantic mirrors:

```bash
cd services/engine && uv run python scripts/export_schema.py          # rewrite after a model change
cd services/engine && uv run python scripts/export_schema.py --check  # CI freshness check
```

`test/marketplace-roundtrip.test.ts` parses a pasted `model_dump_json(by_alias=True)` of every
Sprint 004 `Out` shape and checks the literal unions reject values outside the contract.
`test/schema-parity.test.ts` renders every Zod schema to JSON Schema and requires it to equal the
export, after both sides apply the same canonical form (refs inlined, `title`/`description`
dropped, `required` sorted, `type: [T, "null"]` written as `anyOf`, Zod's regex restatement of
`format: date` / `date-time` ignored). Change a field on either side and the test fails until
the other side follows. Adding a schema means: Pydantic model → `export_schema.py` map → Zod
mirror → parity `cases` list → regenerate `schema.json`.

Conventions carried by the schemas: money is integer USD per day (D-16); dates are ISO
date-only strings, timestamps ISO date-time with offset; IDs are kebab-case slugs; every record
carries `demoData` defaulting to `true`; `maximumTeamSize` is 1–5; `location` is required when
`deliveryMode` is `on-site` (enforced by the engine validator); integers stay within the
JavaScript safe range on both sides. Nullable optional fields are written `.nullable().default(null)`
so a parsed object always has the key; the one exception is `SharedContact`, where the engine
omits unshared keys and the client reads absent as "not shared".

```bash
pnpm --filter @venture-route/contracts build      # emits dist/ (the web app imports the built package)
pnpm --filter @venture-route/contracts test
pnpm --filter @venture-route/contracts typecheck
```
