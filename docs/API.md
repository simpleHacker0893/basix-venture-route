# Engine HTTP API

Base URL locally: `http://localhost:8000` (`docker compose up engine` or
`uv run uvicorn app.main:app --reload` inside `services/engine`). Interactive docs at `/docs`.

Every request and response shape is a Zod schema in `packages/contracts` mirrored by a Pydantic
model in the engine; `scripts/export_schema.py --check` keeps the two equal. Field names are
camelCase on the wire, dates are ISO date-only strings, money is integer USD per day (D-16).

| Area | Endpoints | Auth |
|---|---|---|
| Health | `GET /health` | none |
| Routing | `POST /api/route`, `POST /api/conversation`, `GET /api/scenarios` | none |
| Builder | `POST /api/me/role`; `GET`/`PUT /api/me/profile`; `GET`/`POST /api/me/credentials`; `GET`/`POST /api/me/projects` | Clerk session, role `builder` (`/role`: any session) |
| Founder | `GET /api/builders/{builderId}` | Clerk session, role `founder` or `admin` |
| Admin | `GET /api/admin/pending`; `POST /api/admin/confirm/{kind}/{id}`; `POST /api/admin/reject/{kind}/{id}` | Clerk session, role `admin` |
| Webhook | `POST /api/webhooks/clerk` | Svix signature |
| Dev only | `POST /internal/query` | `ENGINE_DEV_QUERY=1` |

## Cross-origin calls (D-30)

The engine allows browser origins listed in `CORS_ORIGINS` (comma-separated; default
`http://localhost:5173,http://localhost:4173`, the Vite dev and preview servers). Methods `GET`,
`POST` and `PUT`; headers `content-type` and `authorization`; credentials on, so the Clerk bearer
header passes. A preflight from a listed origin answers `200` with `access-control-allow-origin`;
an origin outside the list gets no allow-origin header. The Vite dev server also proxies `/api`
and `/health`, so local development needs no CORS.

## Authentication and roles (D-03)

Marketplace routes take `Authorization: Bearer <Clerk session JWT>`. The engine verifies RS256
against the JWKS at `CLERK_JWKS_URL` (fetched once at start-up, refetched once on an unknown
`kid`), checks `exp` and `nbf` with thirty seconds of leeway and the issuer, and reads the role
from the `metadata.role` claim the Operator adds to Clerk's session token template
(`{"metadata": "{{user.public_metadata}}"}`).

| Status | Body | When |
|---|---|---|
| `401` | `{"detail": "invalid session"}` | missing, malformed, expired or wrong-issuer token, or Clerk not configured. Never a `500`. |
| `403` | `{"detail": "role builder required"}` (or `founder or admin`, `admin`) | wrong role, no role yet, or no users row yet (webhook not arrived) |
| `503` | `{"detail": "marketplace store not configured"}` | `DATABASE_URL` is the `.env.example` placeholder; routing still works from seed |

Roles: `founder` and `builder` are chosen once through `POST /api/me/role`; `admin` comes only
from `ADMIN_EMAILS` through the webhook. Guards apply at the router level.

## Errors

Validation failures answer `422` with the contract's validation-error shape and a field-specific
message, never a partial result:

```json
{ "type": "validation-error", "message": "location: Value error, location is required when deliveryMode is on-site" }
```

Engine failures (runtime unavailable, unparseable rule output) answer `502` with
`detail: "engine error: ..."`. Every other `detail` string is listed with its endpoint below.

## GET /health

Always on. Confirms the Hyperon runtime loaded the seed graph in-process and reports how many
atoms the marketplace projection added.

```json
{
  "status": "ok",
  "facts_loaded": 181,
  "rules_loaded": 7,
  "projected_rows": 0,
  "hyperon_version": "0.2.10",
  "demo_today": "2026-09-22"
}
```

`facts_loaded` counts seed atoms only. `projected_rows` counts atoms rendered from confirmed
marketplace rows (D-15); it is `0` without a store. `rules_loaded` is answered by the space
itself: the engine queries for at least one equation of each of the seven named MeTTa rules
from `planning/DOMAIN.md` (`verified-for-skill`, `mode-compatible`, `available-for-brief`,
`eligible-builder`, `reuse-fit`, `partner-fit`, `route-gap`). Helper equations inside
`rules.metta` do not count. `demo_today` echoes the frozen demo clock (D-14).

## POST /api/conversation

The main behavioural seam (PRD §5.2): one founder message plus an optional partial brief in,
exactly one of three `ChatResponse` shapes out, always `200`.

Request (`ChatTurn`):

```json
{ "userMessage": "I want to build something for farmers", "currentBrief": { "vertical": "agri" } }
```

`currentBrief` is `Partial<VentureBrief>`: every field optional, `null` means unknown. Field
values are validated (`maximumTeamSize` 1–5, positive `dailyBudget`, known modes and
verticals); a malformed body answers `422` with the validation-error shape.

Responses, discriminated by `type`:

- `clarification`: `missingFields` (PRD §5.3 field names; `location` joins when the mode is
  on-site), a `message` built from template questions keyed by field, and the merged
  `partialBrief`. The language model never writes these questions.
- `route`: the validated `brief` (an id is derived from the title when none was given), the
  `route` (identical to `POST /api/route` for the same brief), and a `message`.
- `validation-error`: the merged brief failed a cross-field rule, e.g.
  `{ "type": "validation-error", "message": "availabilityEnd: availabilityEnd must not precede availabilityStart" }`.

Adapter selection (D-06, D-26): `LLM_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` set uses the
Anthropic adapter for intake and for the route summary; with the key unset, or
`LLM_PROVIDER=null`, the `NullAdapter` extracts nothing and keeps the engine's template summary,
so the structured form is the only input path. If the model times out or errors, the turn falls
back to `NullAdapter` behaviour and `message` carries the form-fallback hint; the client never
sees a `500`. A summary that names an entity outside the route is discarded for the template.

## POST /api/route

The structured-form path: a full `VentureBrief` in, a `VentureRoute` out, no language model
involved. `POST /api/conversation` returns the identical `route` object for the same brief.

Request: a `VentureBrief` (PRD §5.3). `location` is required when `deliveryMode` is `on-site`;
`maximumTeamSize` is 1–5; `dailyBudget` is a positive integer USD per day.

Response `200`: a `VentureRoute` (PRD §5.4):

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
`assembler.budget-fit` from the assembler, D-22) and engine-supplied `nextActions` (D-29).
Confirmed marketplace builders appear here exactly like seed builders, with their display name
derived from the builder slug (D-24).

## GET /api/scenarios

The five seed briefs from `services/engine/seed/briefs.json`, in seed order, as
`VentureBrief[]` so the UI can preload the demo scenarios (`brief-health-01`, `brief-agri-01`,
`brief-constrained-01`, `brief-budget-01`, `brief-onsite-01`). Every brief carries
`demoData: true`.

## Builder: `/api/me/*`

### POST /api/me/role

Any verified session, once. Writes `publicMetadata.role` through the Clerk Backend API and
upserts the local users row, so it works before the webhook has arrived.

```json
{ "role": "builder" }
```

Response `200` `RoleResponse`: `{ "clerkId": "user_…", "role": "builder", "confirmed": false }`.
`admin` is refused with `422`; a second call answers `409 {"detail": "role already chosen"}`.

### GET / PUT /api/me/profile

Role `builder`. `GET` answers `404 {"detail": "no profile yet"}` before the first save. `PUT`
creates or replaces the profile (`ProfileInput`) and never touches the account status:

```json
{
  "displayName": "Jane Mwangi", "headline": "Backend builder", "cohortId": "cohort-2026a",
  "location": "Nairobi", "dayRate": 140,
  "modes": { "remote": true, "hybrid": true, "onSite": false },
  "selfDescribedSkills": ["python", "backend"],
  "phone": "+254700000000", "linkedin": "linkedin.com/in/jane-mwangi",
  "sharing": { "email": true, "phone": false, "linkedin": true },
  "availability": [{ "start": "2026-09-22", "end": "2026-10-20" }]
}
```

Rules: display name 1–80 characters with a letter or digit, at least one delivery mode, up to
nine self-described skills from the nine skill ids, up to twelve availability ranges with
`end ≥ start`. Response `BuilderProfile` adds `builderId` (a slug from the display name,
suffixed `-2`, `-3` on collision, immutable afterwards, D-24), `contact` (email from the
account), `skills`, `accountStatus` (`pending | confirmed | rejected`), `confirmed` and `demoData`.

One skill shape everywhere: `{ "id": "python", "name": "Python", "status": "verified", "evidence": "both" }`.
`status` is `verified` only when a confirmed credential or confirmed project proves the skill
(`evidence` `credential`, `project` or `both`); otherwise `self-described` with `evidence: null`,
which the web renders as "Self-described · display only". The browser never computes this.

### GET / POST /api/me/credentials, GET / POST /api/me/projects

Role `builder`; `404 {"detail": "no profile yet"}` until the profile exists. Proof is created
`pending` (`201`) and only an admin decision changes its status.

```json
{ "title": "Python 201", "issuer": "Omni University", "skillId": "python" }
{ "title": "Clinic triage intake flow", "vertical": "health", "licensable": true, "completedOn": "2026-08-30", "skillIds": ["python", "ui-ux"] }
```

`Credential` and `Project` responses echo the input plus `id`, `status` and `demoData`. A project
takes one to five skill ids and a seed vertical.

## Founder: GET /api/builders/{builderId}

Role `founder` or `admin`. A confirmed builder as a founder sees them (`Candidate`):

```json
{
  "builderId": "jane-mwangi", "displayName": "Jane Mwangi", "headline": "Backend builder",
  "cohortId": "cohort-2026a", "location": "Nairobi", "dayRate": 140,
  "modes": { "remote": true, "hybrid": true, "onSite": false },
  "availability": [{ "start": "2026-09-22", "end": "2026-10-20" }],
  "skills": [{ "id": "python", "name": "Python", "status": "verified", "evidence": "both" },
             { "id": "backend", "name": "Backend", "status": "self-described", "evidence": null }],
  "projects": [{ "id": "…", "title": "Clinic triage intake flow", "vertical": "health", "licensable": true,
                 "completedOn": "2026-08-30", "skillIds": ["python", "ui-ux"], "status": "confirmed", "demoData": true }],
  "contact": { "email": "jane@example.com", "linkedin": "linkedin.com/in/jane-mwangi" },
  "confirmed": true, "demoData": true
}
```

`contact` carries only the keys whose sharing toggle is on, never nulls (DOMAIN.md §Marketplace
rules). `projects` lists confirmed projects only. Unconfirmed, rejected and unknown builders, and
seed builder ids that have no account, answer `404 {"detail": "no confirmed builder <id>"}`; a
`builder` session answers `403`.

## Admin: `/api/admin/*`

Role `admin`. Admins are never user-chosen: the webhook assigns the role to emails in
`ADMIN_EMAILS` and confirms them.

### GET /api/admin/pending

`PendingQueue`: `{ "accounts": [...], "credentials": [...], "projects": [...] }`. Accounts are
pending founders and builders (`id`, `clerkId`, `email`, `role`, `builderId`, `displayName`,
`cohortId`, `submittedAt`); credentials and projects carry their builder's slug and display name
plus the row fields. Every row has `demoData: true`.

### POST /api/admin/confirm/{kind}/{id}, POST /api/admin/reject/{kind}/{id}

`kind` is `account`, `credential` or `project` (`422` otherwise); `id` is the row UUID (`404`
`{"detail": "no pending <kind> <id>"}` when unknown). Any transition is allowed so a mistake can
be reversed; every decision appends a `confirmations` row. The status is committed, then the
engine rebuilds its space in the same request (D-15) and answers:

```json
{ "id": "…", "kind": "project", "status": "confirmed", "projectedRows": 19 }
```

Only builders whose account is confirmed produce atoms; rejecting an account removes the builder
from the graph on that rebuild, rejecting a project drops its `demonstrates` facts so evidence
falls back to `credential`. Reprojection on demo-size data takes well under a second.

## Webhook: POST /api/webhooks/clerk

Mounted outside the session guards. Requires the Svix headers `svix-id`, `svix-timestamp`
(within five minutes) and `svix-signature`, verified with HMAC-SHA256 over `id.timestamp.body`
using `CLERK_WEBHOOK_SIGNING_SECRET`; any failure answers `400 {"detail": "invalid webhook signature"}`.

`user.created` and `user.updated` upsert one users row keyed on the Clerk id (email and
`public_metadata.role`); a replayed event is a no-op. An email in `ADMIN_EMAILS`
(case-insensitive) becomes `admin` with a confirmed account, and the role is written back to
Clerk so the session claim agrees. Response `{ "handled": true, "clerkId": "…", "role": "admin", "confirmed": true }`.
Other event types answer `200 { "handled": false }` so Clerk does not retry. The webhook never
triggers a reprojection.

Local development forwards events with the Clerk CLI's webhook listener; the secret it prints
goes into `.env`.

## POST /internal/query (dev-only)

**Off by default.** The route answers `404 Not Found` unless the engine runs with
`ENGINE_DEV_QUERY=1`. Never enable it in a deployed engine: it exposes raw engine output for
seed briefs and exists only so a developer can watch the rules work.

Request `{ "briefId": "brief-health-01" }` with one of the seed brief ids; unknown ids answer
`404` with the id in `detail`. Response: the typed tuples straight from `MettaRouteEngine`, each
carrying a reasoning path (`rule`, ordered `facts` as written in the space, `conclusion`):

```json
{
  "briefId": "brief-health-01",
  "eligible": [{ "builderId": "amina-otieno", "skillId": "python", "evidence": "both",
                 "path": { "rule": "eligible-builder", "facts": ["(earned amina-otieno cred-py-201)", "(proves cred-py-201 python)", "..."], "conclusion": "amina-otieno is eligible for python with both evidence" } }],
  "reuse": [{ "assetId": "asset-afya-triage", "skillIds": ["ai-metta", "python"], "path": { "rule": "reuse-fit", "...": "..." } }],
  "partners": [{ "partnerId": "amani-health", "builderId": "amina-otieno", "universityId": "omni-university", "cohortId": "cohort-2026a", "path": { "rule": "partner-fit", "...": "..." } }],
  "gaps": []
}
```

Team assembly, status and the `team-size` / `budget` gaps belong to `POST /api/route` and are
not part of this endpoint.
