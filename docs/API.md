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
