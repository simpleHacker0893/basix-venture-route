# Venture Route

> Evidence-backed venture routing through the BASIX ecosystem, decided by MeTTa graph rules.

**Status:** Sprints 000–002 merged (engine, routing core, founder UI). Sprint 003 (marketplace: Clerk sign-in, Neon Postgres, admin confirmation projected into the graph) is in progress on `sprint/003-marketplace`. Hackathon proof of concept for the SingularityNET MeTTa track; demo Thursday 1 October 2026. Every record is fictional demo data.

Venture Route turns a founder's plain-language venture brief into the smallest credible route through a BASIX-shaped ecosystem: verified builders, reusable IP, cohort and university context, a relevant partner, daily cost, and explicit capability gaps.

It is not an AI matcher. MeTTa relationship rules over inspectable facts decide eligibility, evidence, availability, delivery-mode fit, reusable-IP fit, partner fit and gaps. A language model may make intake conversational and explain a computed route, but it never selects people, invents evidence, or sets the route status. Those rules are non-negotiable and are listed in `AGENTS.md`.

## Demo links

| What | Link |
|---|---|
| Live demo | _to be added by the Operator_ |
| Demo video (YouTube) | _to be added by the Operator_ |
| Pitch deck (Canva, 12 slides) | _to be added by the Operator_ |

Founder: **Njuguna Njenga** (Operator). Other team members: _to be named_ (Q-08).

## What runs today

- **Engine** (`services/engine`): FastAPI with the official Hyperon runtime (`hyperon==0.2.10`) in-process, seven named MeTTa rules over a fictional seed graph, a deterministic team assembler, and a language-model adapter that only narrates. `POST /api/route` answers the structured form; `POST /api/conversation` answers chat. Every result carries typed reasoning paths.
- **Web app** (`apps/web`): React 19 PWA. Chat or form intake, brief review, the route result with gaps above team cards, the "Why this route?" drawer over the reasoning paths, a plain-text handoff, an offline demonstration mode, and the landing page from the approved Stitch designs.
- **Marketplace** (Sprint 003, engine side merged on the sprint branch): Clerk session verification, a Postgres store with Alembic migrations, builder profiles, credentials and projects, a founder-facing candidate view, and an admin queue whose confirmations rebuild the MeTTa space so user-entered builders appear in routes with the same evidence as seed builders.

`GET /health` proves the runtime loaded the graph and all seven rules:

![Swagger UI showing GET /health returning facts_loaded 181, rules_loaded 7 and hyperon_version 0.2.10](docs/images/engine-health-swagger.png)

`POST /internal/query` (dev-only) runs the rules for a seed brief. Below, the constrained brief asks for `mobile` and `rust`: the Rust builder is eligible with a full fact chain, and `route-gap` reports an honest `skill` gap for `mobile` with engine-supplied next actions instead of a fabricated match:

![Response body for brief-constrained-01: one eligible builder for rust with ten source facts, and a skill gap for mobile with next actions](docs/images/engine-query-response.png)

## Quick start

Five minutes to a running engine, a running web app and green test suites. No API keys are needed: without an Anthropic key the engine serves every response through its null adapter, and without a Clerk key the web app runs the routing flow and shows a "Sign-in is not configured" panel on account screens.

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.12.x | Pinned in `.python-version`. No hyperon wheel exists for 3.13. |
| uv | 0.8+ | Manages the engine's virtualenv and lockfile. |
| Node.js + pnpm | Node 24, pnpm 9.12 | `packageManager` in `package.json`; Corepack or `npm i -g pnpm@9.12.0`. |
| Docker + Compose v2 | optional | Runs the engine container and the local Postgres 18 used by the marketplace. |
| Visual C++ 2015-2022 runtime | Windows only | The hyperon Windows wheel needs `MSVCP140.dll`: `winget install Microsoft.VCRedist.2015+.x64`. |

### 1. Engine

```bash
git clone https://github.com/simpleHacker0893/basix-venture-route.git
cd basix-venture-route
cp .env.example .env                 # placeholders are fine for the routing flow
cd services/engine
uv sync                              # FastAPI, hyperon 0.2.10, SQLModel, dev tools from uv.lock
uv run uvicorn app.main:app --reload # http://127.0.0.1:8000, interactive docs at /docs
```

Verify:

```bash
curl -s http://127.0.0.1:8000/health
# {"status":"ok","facts_loaded":181,"rules_loaded":7,"projected_rows":0,"hyperon_version":"0.2.10","demo_today":"2026-09-22"}
```

### 2. Web app

```bash
pnpm install                         # from the repo root; installs apps/web and packages/contracts
pnpm --filter @venture-route/contracts build
pnpm --filter web dev                # http://localhost:5173, proxies /api and /health to the engine
```

Pick a demo scenario chip on `/route`, or describe an MVP in the chat, and follow the brief to a route.

### 3. Marketplace store (optional)

The marketplace endpoints need Postgres. Locally the compose `db` service runs PostgreSQL 18, the same major as the Neon project the demo uses (D-37):

```bash
docker compose up -d db
docker compose exec db psql -U postgres -c "create database venture_route_test;"
cd services/engine
ALEMBIC_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/venture_route uv run alembic upgrade head
```

Point `DATABASE_URL` in `.env` at that database (`postgresql+asyncpg://postgres:postgres@localhost:5432/venture_route`) and restart the engine. Leaving the placeholder means "no store": routing still works from seed and every marketplace route answers `503`.

### 4. Everything in containers

```bash
cp .env.example .env
docker compose up                    # db (postgres:18) then engine; run migrations once:
docker compose run --rm engine alembic upgrade head
```

The engine image is `python:3.12-slim` with uv, a non-root user, the migrations, and a health check. The web app is served by Vite locally and by Vercel in deployment (D-27).

## Test, lint, type-check

The same commands CI runs (`.github/workflows/ci.yml`).

```bash
# engine
cd services/engine
uv run pytest -q                              # marketplace tests need TEST_DATABASE_URL, else they skip
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/venture_route_test uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy .                                 # strict, over app, tests and scripts
uv run python scripts/export_schema.py --check           # Zod ↔ Pydantic JSON Schema is current
uv run python scripts/export_offline_snapshot.py --check # offline demo snapshot is current

# web and contracts (from the repo root)
pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test
pnpm --filter web e2e                          # Playwright: builds, starts the engine on LLM_PROVIDER=null, runs against vite preview
```

Engine tests run against the real Hyperon runtime; there are no mocks of it, and the suite fails rather than skips when hyperon is missing. Marketplace tests run `alembic upgrade head` once on an empty `TEST_DATABASE_URL` and roll every test back. Never point that variable at a database you care about.

## Configuration

Copy `.env.example` to `.env`. Every variable any service reads is listed there with a comment; secrets never live in the repo (D-26). The engine reads the repo-root `.env`, then an optional `services/engine/.env` that overrides it, then the process environment. A placeholder value is treated as unset, never as an error.

| Variable | Read by | Purpose |
|---|---|---|
| `DEMO_TODAY`, `MIN_OVERLAP_DAYS` | engine | Frozen demo clock (D-14) and the availability overlap rule (D-08). |
| `ENGINE_DEV_QUERY` | engine | `1` exposes `POST /internal/query`. Never in a deployed engine. |
| `CORS_ORIGINS` | engine | Browser origins allowed to call the engine (D-30); Vite dev and preview by default. |
| `LLM_PROVIDER`, `ANTHROPIC_API_KEY` | engine | `anthropic` with a key uses the official SDK; otherwise the null adapter and the structured form (D-06). |
| `DATABASE_URL`, `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL` | engine | Neon Postgres in the asyncpg `?ssl=require` form (D-17); the direct URL is for Alembic; the test URL is for pytest. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | compose | The local `db` service; the engine container derives its `DATABASE_URL` from them. |
| `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ADMIN_EMAILS` | engine | Session verification, the Backend API call that writes the role, webhook verification, and the first admins (D-03). |
| `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_OFFLINE_DEMO` | web | Engine base URL, the browser-safe Clerk key, and the offline demonstration switch. |

## Architecture

```text
React PWA (apps/web)                      renders VentureRoute only; never parses MeTTa
  │  Zod-parsed HTTP, bearer token on /api/me, /api/admin, /api/builders
  ▼
FastAPI engine (services/engine)
  ├─ conversation orchestrator ──► LLM adapter (intake, summary)   receives only structured data
  ├─ route service ─────────────► MettaRouteEngine ──► Hyperon runtime
  │        │                          ▲   seed/facts.metta + seed/rules.metta + projected rows
  │        └─ deterministic assembler │   status is a pure function of gaps and coverage
  ├─ marketplace API ──► Postgres (SQLModel, Alembic, asyncpg)
  │        └─ admin confirm / reject ──► reproject(): full rebuild of the space (D-15)
  └─ Clerk: JWT verification, roles from publicMetadata, signed webhook (D-03)
```

### The decision boundary

`services/engine/app/engine/metta_engine.py` is the only module that knows about the Hyperon runtime, MeTTa syntax and atom parsing. Its public methods are the seams every later layer builds on:

| Method | Named rule | Returns |
|---|---|---|
| `eligible_builders(brief)` | `eligible-builder` (over `verified-for-skill`, `mode-compatible`, `available-for-brief`) | one tuple per builder × skill with `credential`, `project` or `both` evidence |
| `reuse_candidates(brief)` | `reuse-fit` | licensable assets in the brief's vertical that demonstrate a required skill |
| `partner_candidates(brief, builder_ids)` | `partner-fit` | the four-hop chain vertical → partner → university → cohort → builder |
| `cohort_of(builder_id)` | `cohort-of` lookup | cohort and university |
| `gaps(brief)` | `route-gap` | `skill`, `availability`, `mode` or `location` gap per required skill |
| `replace_space(program)` | none | swaps in a fresh runtime holding the seed files plus projected marketplace facts |

Every result carries a **reasoning path**: the rule name, the ordered source facts exactly as written in the space, and a one-line conclusion. The UI renders these; the language model only narrates them.

How a query runs: the brief's fields are added to the space as `brief-*` atoms under a lock, one `!(rule ...)` expression is evaluated, the witnesses (which embed the facts they matched) are parsed into Pydantic models, and the brief atoms are removed. Date overlap is the one Python-grounded atom (`overlap-days`); the rule that combines it with everything else is MeTTa. There is no Python matcher, and the review greps to make sure one never appears.

### Marketplace and projection

Builders sign in with Clerk and keep a profile, availability, credentials and showcase projects in Postgres. A skill on a profile is `verified` only when a confirmed credential or a confirmed project proves it; a self-described skill is display only and never satisfies `verified-for-skill`. An admin confirms or rejects accounts, credentials and projects; each decision commits, then `reproject()` renders every confirmed builder into the same predicates the seed uses (`confirmed`, `day-rate`, `located-in`, `supports-mode`, `available`, `earned`/`proves`, `built`/`demonstrates`, `licensable`/`vertical`) and rebuilds the space. No new predicate and no new rule name; `GET /health` reports the projected atom count as `projected_rows`. Decisions are recorded in `docs/adr/`.

### Named rules

`verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`, `reuse-fit`, `partner-fit`, `route-gap`. Definitions and semantics: `planning/DOMAIN.md`. Source: `services/engine/seed/rules.metta`. `/health` reports `rules_loaded` by asking the space for an equation of each one.

### Repository layout

```text
services/engine/        FastAPI + Hyperon engine (uv, Python 3.12)
  app/api/              /health, /api/route, /api/conversation, /api/scenarios, /api/me/*, /api/builders/*, /api/admin/*, /api/webhooks/clerk, /internal/query
  app/engine/           MettaRouteEngine, grounded atoms, atom parsing, projection, EngineError
  app/conversation/     orchestrator: merge → missing fields → clarification or route
  app/llm/              LlmAdapter protocol, Anthropic adapter, null adapter
  app/auth/             Clerk JWKS cache, session verification, require_role, Svix webhook
  app/db/               async engine and session dependency (Neon / compose db)
  app/marketplace/      SQLModel tables, repository, verified-skill derivation, wire schemas
  app/models/           VentureBrief, VentureRoute, chat and engine result models
  alembic/              migrations (0001_marketplace); `alembic upgrade head` is the release command
  seed/                 facts.metta, rules.metta, briefs.json (five demo scenarios)
  scripts/              export_schema.py, export_offline_snapshot.py (both have --check)
  tests/                real-runtime, HTTP-seam and database tests
packages/contracts/     Zod schemas + generated JSON Schema mirrored by Pydantic (see its README)
apps/web/               React 19 + Vite PWA (see its README)
docs/                   API.md, PRD.md, adr/, design/ (Stitch prompts), agents/, images/
design/stitch/          approved Stitch exports per batch; they win over the prompt pack (D-36)
planning/               operating pack: STATE, DECISIONS, DOMAIN, TIMELINE, PROMPTS, sprints/
graphify-out/           knowledge graph of the repo (graph.json, GRAPH_REPORT.md)
docker-compose.yml      db (postgres:18) and engine
.github/workflows/      ci.yml: engine and web jobs, no secrets
```

## Demo scenarios

Seed briefs in `services/engine/seed/briefs.json`, loaded as chips on `/route`. Expected outcomes are pinned by tests and listed in `planning/DOMAIN.md`.

| Brief ID | Scenario | Route |
|---|---|---|
| `brief-health-01` | Health pilot: python, ai-metta, ui-ux; hybrid; USD 400/day; reusable IP | `feasible`: three builders for USD 370, `asset-afya-triage`, partner `amani-health` via four hops |
| `brief-agri-01` | Agri marketplace: frontend, backend, domain-research; remote | `feasible`: a different team for USD 315, `asset-shamba-records`, partner `shamba-agri` |
| `brief-constrained-01` | Mobile + Rust, remote, two weeks | `partial`: Rust builder eligible, `skill` gap for mobile |
| `brief-budget-01` | Health pilot at USD 250/day | `partial`: no team, one `budget` gap naming the USD 370 team |
| `brief-onsite-01` | Health pilot on-site in Kisumu | `partial`: `location` gaps |

All builders, credentials, projects, cohorts, universities and partners are fictional and carry `demoData: true`; the UI shows a Demo data pill on every seed-derived or user-entered record.

## Development workflow

Planning follows the 120x Architect/Builder Operating Pack. Start with `AGENTS.md`, then `planning/STATE.md`, `planning/DECISIONS.md`, `planning/DOMAIN.md`, `planning/TIMELINE.md` and the current sprint folder.

- One branch and one pull request per sprint (`sprint/NNN-slug`), gated by the sprint's `acceptance.md` with pasted command output.
- Tickets are GitHub Issues labelled `sprint:NNN` and `ready-for-agent`, sliced with the Matt Pocock skills (`/to-tickets`, `/implement`, `/tdd`, `/code-review`); the exact prompts are in `planning/PROMPTS.md`.
- Tests are written only at the seams fixed per sprint (D-19): HTTP endpoints, pure functions, rendered screens, Playwright flows. No component-internal or mock-the-runtime tests.
- Conventional Commits ending in `(#issue)`. Python: ruff and mypy strict. TypeScript: strict and eslint.
- Glossary in `CONTEXT.md`; decisions as ADRs in `docs/adr/`; open questions in `planning/QUESTIONS.md`, never guessed.

### Roadmap

| Sprint | Window (EAT) | Delivers | State |
|---|---|---|---|
| 000 MeTTa spike | 22–23 Sep | engine, rules, seed graph, `/health` | merged |
| 001 Routing core | 23–24 Sep | `POST /api/conversation`, team assembler, deterministic status, Zod ↔ Pydantic contracts, LLM adapter with form fallback | merged |
| 002 Founder UI | 25–26 Sep | React intake, brief review, route result with gaps first, "Why this route?" drawer, handoff, PWA, landing | merged |
| 003 Marketplace | 27–28 Sep | Clerk roles, Postgres store, profiles and proof, admin confirmation projected into the graph | in progress |
| 004 Requests & interviews | 29 Sep | requests board, eligibility-gated bids, bookings | planned |
| 005 Demo hardening | 30 Sep | single launch command, Railway + Vercel deploy, recording, pitch | planned |
| 006 Chloe voice intake | after the demo | browser-speech voice skin over the unchanged conversation API (D-38) | planned |

## Contributing

1. Read `AGENTS.md`; the non-negotiables there are enforced in review.
2. Pick an open issue labelled `ready-for-agent` for the current sprint.
3. Write the failing test at an agreed seam first, then the minimal code, then run the commands under "Test, lint, type-check" for the packages you touched.
4. Commit per ticket with a Conventional Commit message ending in `(#issue)`; close the issue with the test command and output.
5. Open questions go to `planning/QUESTIONS.md`; never guess a business rule.

## References

- Engine API reference: `docs/API.md`. Product requirements: `docs/PRD.md`. Decisions: `planning/DECISIONS.md` and `docs/adr/`.
- [MeTTa language](https://metta-lang.dev/), [Hyperon experimental runtime](https://github.com/trueagi-io/hyperon-experimental), [MeTTa specification](https://trueagi-io.github.io/hyperon-experimental/metta/)

## License

MIT

---

Built as a BASIX-focused hackathon proof of concept. No real people, availability, credentials, IP ownership, or partner relationships are represented.
