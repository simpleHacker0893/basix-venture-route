# Engine HTTP API

Base URL locally: `http://localhost:8000` (`docker compose up engine` or
`uv run uvicorn app.main:app --reload` inside `services/engine`).

## GET /health

Always on. Confirms the Hyperon runtime loaded the seed graph in-process.

```json
{
  "status": "ok",
  "facts_loaded": 181,
  "rules_loaded": 7,
  "hyperon_version": "0.2.10",
  "demo_today": "2026-09-22"
}
```

`rules_loaded` is answered by the space itself: the engine queries for at least one equation of
each of the seven named MeTTa rules from `planning/DOMAIN.md` (`verified-for-skill`,
`mode-compatible`, `available-for-brief`, `eligible-builder`, `reuse-fit`, `partner-fit`,
`route-gap`). Helper equations inside `rules.metta` do not count. `demo_today` echoes the frozen
demo clock (D-14).

## POST /api/route

The structured-form path (requirements.md item 7): a full `VentureBrief` in, a `VentureRoute`
out, no language model involved. `POST /api/conversation` returns the identical `route`
object for the same brief (parity test in Sprint 001).

Request: a `VentureBrief` (`packages/contracts`, PRD §5.3). `location` is required when
`deliveryMode` is `on-site`; `maximumTeamSize` is 1–5; `dailyBudget` is a positive integer
USD per day (D-16).

Response `200`: a `VentureRoute` (PRD §5.4), camelCase on the wire:

```json
{
  "status": "feasible",
  "builders": [{ "builderId": "amina-otieno", "name": "Amina Otieno", "dayRate": 120,
                 "covers": ["python"], "evidenceType": "both", "evidencePaths": [{ "rule": "eligible-builder", "facts": ["..."], "conclusion": "..." }] }],
  "totalDailyRate": 370,
  "reusableIp": { "assetId": "asset-afya-triage", "title": "Afya Triage", "path": { "rule": "reuse-fit", "...": "..." } },
  "cohort": { "cohortId": "cohort-2026a", "universityId": "omni-university", "path": { "rule": "cohort-of", "...": "..." } },
  "partner": { "partnerId": "amani-health", "path": { "rule": "partner-fit", "facts": ["(supports-vertical amani-health health)", "..."], "conclusion": "..." } },
  "gaps": [],
  "rulesApplied": ["cohort-of", "eligible-builder", "partner-fit", "reuse-fit"],
  "summary": "Feasible route: 3 builders (Amina Otieno, Daniel Kiptoo, Grace Wambui) cover ai-metta, python, ui-ux for USD 370 a day. Reusable IP: Afya Triage. Partner: amani-health."
}
```

`status` is computed by the route service from the gap set and coverage (D-09): all required
skills covered by a team within size and budget → `feasible`; no builder eligible for any
required skill → `infeasible` (`builders: []`, no `reusableIp`, `cohort` or `partner`, D-23);
otherwise `partial`. Gaps carry `rule` (`route-gap` from MeTTa; `assembler.team-size-fit` /
`assembler.budget-fit` from the assembler, D-22).

Validation failures answer `422` with the contract's validation-error shape and a
field-specific message, never a route:

```json
{ "type": "validation-error", "message": "location: Value error, location is required when deliveryMode is on-site" }
```

## GET /api/scenarios

The five seed briefs from `services/engine/seed/briefs.json`, in seed order, as
`VentureBrief[]` so the UI can preload the demo scenarios (`brief-health-01`, `brief-agri-01`,
`brief-constrained-01`, `brief-budget-01`, `brief-onsite-01`). Every brief carries
`demoData: true`.

## POST /internal/query (dev-only)

**Off by default.** The route answers `404 Not Found` unless the engine runs with
`ENGINE_DEV_QUERY=1`. Never enable it in a deployed engine: it exposes raw engine output
for seed briefs and exists only so a developer can watch the rules work before the
conversation API lands in Sprint 001.

Request:

```json
{ "briefId": "brief-health-01" }
```

`briefId` must be one of the seed briefs in `services/engine/seed/briefs.json`
(`brief-health-01`, `brief-agri-01`, `brief-constrained-01`, `brief-budget-01`, `brief-onsite-01`).
Unknown IDs answer `404` with the ID in `detail`.

Response: the typed tuples straight from `MettaRouteEngine`, camelCase on the wire, each
carrying a reasoning path (`rule`, ordered `facts` as written in the space, `conclusion`).

```json
{
  "briefId": "brief-health-01",
  "eligible": [
    {
      "builderId": "amina-otieno",
      "skillId": "python",
      "evidence": "both",
      "path": {
        "rule": "eligible-builder",
        "facts": ["(earned amina-otieno cred-py-201)", "(proves cred-py-201 python)", "..."],
        "conclusion": "amina-otieno is eligible for python with both evidence"
      }
    }
  ],
  "reuse": [{ "assetId": "asset-afya-triage", "skillIds": ["ai-metta", "python"], "path": { "rule": "reuse-fit", "...": "..." } }],
  "partners": [{ "partnerId": "amani-health", "builderId": "amina-otieno", "universityId": "omni-university", "cohortId": "cohort-2026a", "path": { "rule": "partner-fit", "...": "..." } }],
  "gaps": []
}
```

A gap looks like `{ "category": "skill", "statement": "...", "affected": ["mobile"],
"nextActions": ["..."], "rule": "route-gap" }`.

`partners` is computed for every eligible builder of the brief. Team assembly, status and
the `team-size` / `budget` gaps are Sprint 001 (D-09) and are not part of this endpoint.

Engine failures (runtime unavailable, unparseable rule output) answer `502` with
`detail: "engine error: ..."`.
