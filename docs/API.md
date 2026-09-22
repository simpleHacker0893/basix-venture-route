# Engine HTTP API

Base URL locally: `http://localhost:8000` (`docker compose up engine` or
`uv run uvicorn app.main:app --reload` inside `services/engine`).

## GET /health

Always on. Confirms the Hyperon runtime loaded the seed graph in-process.

```json
{
  "status": "ok",
  "facts_loaded": 186,
  "rules_loaded": 7,
  "hyperon_version": "0.2.10",
  "demo_today": "2026-09-22"
}
```

`rules_loaded` counts the seven named MeTTa rules from `planning/DOMAIN.md`
(`verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`,
`reuse-fit`, `partner-fit`, `route-gap`). Helper equations inside `rules.metta` do not count.

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

Response: the typed tuples straight from `MettaRouteEngine`, each carrying a reasoning path
(`rule`, ordered `facts` as written in the space, `conclusion`).

```json
{
  "briefId": "brief-health-01",
  "eligible": [
    {
      "builder_id": "amina-otieno",
      "skill_id": "python",
      "evidence": "both",
      "path": {
        "rule": "eligible-builder",
        "facts": ["(earned amina-otieno cred-py-201)", "(proves cred-py-201 python)", "..."],
        "conclusion": "amina-otieno is eligible for python with both evidence"
      }
    }
  ],
  "reuse": [{ "asset_id": "asset-afya-triage", "skill_ids": ["ai-metta", "python"], "path": { "rule": "reuse-fit", "...": "..." } }],
  "partners": [{ "partner_id": "amani-health", "builder_id": "amina-otieno", "university_id": "omni-university", "cohort_id": "cohort-2026a", "path": { "rule": "partner-fit", "...": "..." } }],
  "gaps": []
}
```

`partners` is computed for every eligible builder of the brief. Team assembly, status and
the `team-size` / `budget` gaps are Sprint 001 (D-09) and are not part of this endpoint.

Engine failures (runtime unavailable, unparseable rule output) answer `502` with
`detail: "engine error: ..."`.
