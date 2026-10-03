# Venture Route

[![CI](https://github.com/simpleHacker0893/basix-venture-route/actions/workflows/ci.yml/badge.svg)](https://github.com/simpleHacker0893/basix-venture-route/actions/workflows/ci.yml)
![Hyperon 0.2.10](https://img.shields.io/badge/MeTTa-Hyperon%200.2.10-1e5a45)
![Rules](https://img.shields.io/badge/named%20rules-7-35418a)
![Demo data](https://img.shields.io/badge/data-fictional%20demo-8a4b12)

> **AI explains. MeTTa decides.** Evidence-backed venture routing through the BASIX ecosystem, decided by MeTTa graph rules.

Venture Route turns a founder's plain-language brief into the **smallest credible team** from the BASIX ecosystem, shows **exactly why** each person qualifies, and says **"no, and here is why"** when the ecosystem cannot deliver.

| Quick links | |
|---|---|
| Live app | [basix-venture-route.vercel.app](https://basix-venture-route.vercel.app/) |
| Live engine | [venture-route-engine.onrender.com/health](https://venture-route-engine.onrender.com/health) |
| Demo videos | [Venture Route](https://youtu.be/jCPnXxG3vuU) · [Venture Route demo](https://youtu.be/dTo9q6tkUmU) · [Team demo](https://youtu.be/jQxrl5ooeQg) |
| Pitch deck | [canva.link/venture-route](https://canva.link/venture-route) |
| Run it locally | [Quick start](#quick-start) (about five minutes, no API keys needed) |
| For MeTTa judges | [Where the MeTTa lives](#for-metta-judges-where-the-metta-lives) |
| Taking over the project | [docs/HANDOFF.md](docs/HANDOFF.md) |

[![Watch the Venture Route video](https://img.youtube.com/vi/jCPnXxG3vuU/hqdefault.jpg)](https://youtu.be/jCPnXxG3vuU)

<table>
  <tr>
    <td><img src="docs/screenshots/route-feasible.png" alt="A feasible route: three builders with evidence badges, reusable IP, cohort and partner"></td>
    <td><img src="docs/screenshots/why-this-route.png" alt="The Why this route drawer listing the named rule and its source facts"></td>
  </tr>
  <tr>
    <td align="center">A route: team, cost, reusable IP, cohort, partner</td>
    <td align="center">"Why this route?": the rule and the facts behind it</td>
  </tr>
</table>

**Status:** Sprints 000–005a merged: the MeTTa engine, the routing core, the founder app, the marketplace (Clerk sign-in, Neon Postgres, requests, eligibility-gated bids, interview bookings), the public Builder Showcase and Chloe voice intake. Deployed: the web app on Vercel and the engine on Render, both live from `master`. Hackathon proof of concept for the SingularityNET MeTTa track. Every record is fictional demo data.

**Team ThisisAnfield:** Njuguna Njenga, Anthony Onyango, Naomi Wangui.

## Contents

[The problem](#the-problem) · [Our answer](#our-answer) · [A worked example](#a-worked-example) · [Why this is different](#why-this-is-different) · [For MeTTa judges](#for-metta-judges-where-the-metta-lives) · [Demo links](#demo-links) · [What runs today](#what-runs-today) · [Quick start](#quick-start) · [Installation criteria](#installation-criteria) · [Deploy](#deploy) · [Test, lint, type-check](#test-lint-type-check) · [Architecture](#architecture) · [Demo scenarios](#demo-scenarios) · [Limitations and what is next](#limitations-and-what-is-next) · [Roadmap](#roadmap)

## The problem

BASIX already holds the ingredients of a venture: verified learning, credentials, builders, completed IP, cohorts, universities and partners. They exist as **records, not as a delivery path**.

A founder with an MVP today has to:

- browse profiles and **guess whether a stated skill is credible**;
- estimate whether a team can meet the **dates, delivery mode and hourly budget**;
- discover reusable IP **by chance**;
- ask BASIX staff for introductions to the right cohort or partner.

That is slow, hard to audit, and it produces recommendations nobody can verify. Asking a language model to "match" people makes it worse: the answer reads confidently, but no one can tell which facts it relied on, or whether it invented any.

## Our answer

Venture Route turns a founder's plain-language venture brief into the smallest credible route through a BASIX-shaped ecosystem: verified builders, reusable IP, cohort and university context, a relevant partner, hourly cost, and explicit capability gaps.

It is not an AI matcher. MeTTa relationship rules over inspectable facts decide eligibility, evidence, availability, delivery-mode fit, reusable-IP fit, partner fit and gaps. A language model may make intake conversational and explain a computed route, but it never selects people, invents evidence, or sets the route status. Those rules are non-negotiable and are listed in `AGENTS.md`.

## A worked example

A founder types: *"I need a health-sector pilot: Python, AI/MeTTa and UI/UX, hybrid, USD 50 an hour for the team, reusable IP preferred."* The brief is extracted into editable chips and confirmed. Then the rules run.

| Step | What the founder sees | Decided by |
|---|---|---|
| Feasible route | Three builders for **USD 47 an hour**: Amina Otieno (Python, USD 15), Daniel Kiptoo (AI/MeTTa, USD 19), Grace Wambui (UI/UX, USD 13), each tagged `credential`, `project` or `both` | `verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`, then the deterministic assembler |
| Reusable IP and partner | `asset-afya-triage`, and the partner `amani-health` reached through a **four-hop chain** | `reuse-fit`, `partner-fit` |
| Why this route? | The named rule and the exact source facts behind every card | the reasoning paths the engine returns |
| Change one constraint: budget USD 31 an hour | **No team.** One named `budget` gap: "Cheapest verified team costs USD 47 an hour; budget is USD 31 an hour", with the next action "Raise the hourly budget to USD 47" | `assembler.budget-fit` |
| Change another: on-site in Kisumu | `infeasible`, with three `location` gaps; no builders invented | `route-gap` |

Every price is per hour (D-59): a builder's rate is a whole number of US dollars from 0 to 50 an hour, and a brief's budget is USD 1 to 250 an hour for the whole team. A team fits when the sum of its members' rates is at most the budget; the deterministic assembler checks it.

The last two rows are the point: when a hard constraint cannot be met, the system reports a **named gap with engine-supplied next actions** instead of producing a plausible-looking team.

## Why this is different

| A typical AI matcher | Venture Route |
|---|---|
| A language model picks people from profiles | **MeTTa rules over inspectable facts** decide eligibility; the model cannot select anyone |
| "Verified" is a label on a profile | A skill is verified **only** when a confirmed credential or a confirmed project proves it; self-described skills never count |
| A recommendation with a confident paragraph | Every builder, IP asset, cohort and partner carries `{ rule, source facts, conclusion }` |
| Always returns a result | Returns `partial` or `infeasible` with a **named gap** and approved next actions |
| Cannot be re-run to the same answer | Route status is a **pure function** of coverage and gaps; the same brief gives the same route |
| Demo data indistinguishable from real data | Every seed or user-entered record shows an amber **Demo data** pill |

## For MeTTa judges: where the MeTTa lives

This section is the shortest path from "is it really MeTTa?" to evidence you can check yourself.

**What runs:** the official Hyperon runtime (`hyperon==0.2.10`) **in-process** with the FastAPI engine. The graph is **181 facts** (14 builders, 10 credentials, 5 projects, 3 licensable IP assets, 3 cohorts, 4 partners, 9 skills) and **seven named rules**, loaded once at start-up.

| Concept | Where |
|---|---|
| The rules | [`services/engine/seed/rules.metta`](services/engine/seed/rules.metta) |
| The facts | [`services/engine/seed/facts.metta`](services/engine/seed/facts.metta) |
| The only module that touches Hyperon | [`services/engine/app/engine/metta_engine.py`](services/engine/app/engine/metta_engine.py) |
| Rule semantics and expected outcomes | [`planning/DOMAIN.md`](planning/DOMAIN.md) |
| Why decisions were made | [`planning/DECISIONS.md`](planning/DECISIONS.md) and [`docs/adr/`](docs/adr/) |

**Two of the rules, verbatim from `rules.metta`.** A skill is verified by a confirmed credential *or* a confirmed completed project:

```metta
(= (verified-for-skill $b $s)
   (match &self (, (earned $b $c) (proves $c $s) (confirmed $adm $c))
      (evidence credential ((earned $b $c) (proves $c $s) (confirmed $adm $c)))))
(= (verified-for-skill $b $s)
   (match &self (, (built $b $p) (demonstrates $p $s) (confirmed $adm $p))
      (evidence project ((built $b $p) (demonstrates $p $s) (confirmed $adm $p)))))
```

The four-hop `partner-fit` chain: brief vertical → partner → university → cohort → builder, in one query:

```metta
(= (partner-fit $brief $b)
   (match &self (, (brief-vertical $brief $v) (supports-vertical $p $v) (partners-with $p $u)
                   (cohort-of $c $u) (belongs-to $b $c))
      (partner $p $u $c ((supports-vertical $p $v) (partners-with $p $u)
                         (cohort-of $c $u) (belongs-to $b $c)))))
```

Every rule returns **witnesses that embed the facts they matched**. The adapter turns them into the reasoning paths the UI shows, without re-deriving anything in Python.

**Guarantees you can verify:**

1. **No Python matcher.** Eligibility, evidence, fit and gaps come from MeTTa. The only Python-grounded atom is date arithmetic (`overlap-days`); the rule that uses it is MeTTa. Review checks that no matcher is reintroduced.
2. **The LLM is a translator.** It extracts brief fields into a strict schema, asks for missing ones, and phrases an explanation from the engine's structured result. It may not select, rank, reject or substitute any person; it receives no raw graph data; the status is not its to set. The system instruction is verbatim in `planning/DOMAIN.md`.
3. **Real runtime in tests.** Engine tests run against Hyperon with no mocks, and the suite **fails rather than skips** if the runtime is missing.
4. **Marketplace data reaches the graph through the same predicates.** An admin confirms a builder; `reproject()` rebuilds the space from the seed files plus confirmed rows, using the same predicates and the same seven rules. No new rule, no side channel.

**Check it in two minutes** (after the [Quick start](#quick-start)):

```bash
curl -s http://127.0.0.1:8000/health
# {"status":"ok","facts_loaded":181,"rules_loaded":7,"projected_rows":0,"hyperon_version":"0.2.10",...}
curl -s http://127.0.0.1:8000/api/scenarios      # the five demo briefs
```

Then open `http://localhost:5173/route`, pick **Health pilot**, open **Why this route?**, and compare each source fact with `facts.metta`. Re-run the **Budget challenge** chip and watch the route turn into a named gap.

## Demo links

| What | Link |
|---|---|
| Live app (Vercel) | [basix-venture-route.vercel.app](https://basix-venture-route.vercel.app/) |
| Live engine (Render) | [venture-route-engine.onrender.com](https://venture-route-engine.onrender.com/health) (`/health`) |
| Pitch deck (Canva, 12 slides) | [canva.link/venture-route](https://canva.link/venture-route) |
| Repository | [github.com/simpleHacker0893/basix-venture-route](https://github.com/simpleHacker0893/basix-venture-route) |

### Demo videos

| [![Venture Route](https://img.youtube.com/vi/jCPnXxG3vuU/hqdefault.jpg)](https://youtu.be/jCPnXxG3vuU) | [![Venture Route demo](https://img.youtube.com/vi/dTo9q6tkUmU/hqdefault.jpg)](https://youtu.be/dTo9q6tkUmU) | [![Venture Route team demo](https://img.youtube.com/vi/jQxrl5ooeQg/hqdefault.jpg)](https://youtu.be/jQxrl5ooeQg) |
|:---:|:---:|:---:|
| [Venture Route](https://youtu.be/jCPnXxG3vuU) | [Venture Route demo](https://youtu.be/dTo9q6tkUmU) | [Team demo](https://youtu.be/jQxrl5ooeQg) |

The live engine is one Render web service (one instance, D-15). On Render's free plan it sleeps when idle and the first request takes up to a minute to wake it. `GET /health` answers `"status":"ok"` with `facts_loaded: 181` and `rules_loaded: 7` once it is ready.

**Team ThisisAnfield:** Njuguna Njenga, Anthony Onyango, Naomi Wangui.

## What runs today

- **Engine** (`services/engine`): FastAPI with the official Hyperon runtime (`hyperon==0.2.10`) in-process, seven named MeTTa rules over a fictional seed graph, a deterministic team assembler, and a language-model adapter that only narrates. `POST /api/route` answers the structured form; `POST /api/conversation` answers chat. Every result carries typed reasoning paths.
- **Web app** (`apps/web`): React 19 PWA. Chat or form intake, brief review, the route result with gaps above team cards, the "Why this route?" drawer over the reasoning paths, a plain-text handoff, an offline demonstration mode, and the landing page from the approved Stitch designs.
- **Marketplace** (Sprints 003–004): Clerk sign-in with founder, builder and admin roles, a Postgres store with Alembic migrations, builder profiles, credentials and projects, a founder-facing candidate view, an admin queue whose confirmations rebuild the MeTTa space so user-entered builders appear in routes with the same evidence as seed builders, requests published from a route, bids gated by the engine's eligibility verdict, interview bookings on a founder-owned state machine, and a founder dashboard.
- **Builder Showcase** (Sprint 005a): a public gallery of shipped products with live and demo links, a YouTube pitch facade, certifications and skill sets. Entries go public only after a BASIX admin confirms them, and Showcase data is **display-only**: it never enters the MeTTa space, and a test proves the five scenario routes are identical with or without it. Contact details are visible only to a signed-in founder.
- **Chloe voice intake** (Sprint 006, folded into 005a): a "Voice: Chloe" switch on `/route` that speaks and listens through the browser, over the unchanged conversation API, so the voice path returns the same route as the form path.

`GET /health` proves the runtime loaded the graph and all seven rules:

![Swagger UI showing GET /health returning facts_loaded 181, rules_loaded 7 and hyperon_version 0.2.10](docs/images/engine-health-swagger.png)

`POST /internal/query` (dev-only) runs the rules for a seed brief. Below, the constrained brief asks for `mobile` and `rust`: the Rust builder is eligible with a full fact chain, and `route-gap` reports an honest `skill` gap for `mobile` with engine-supplied next actions instead of a fabricated match:

![Response body for brief-constrained-01: one eligible builder for rust with ten source facts, and a skill gap for mobile with next actions](docs/images/engine-query-response.png)

## Screens

Captured from the merged app with Playwright (`docs/screenshots/`, engine on `LLM_PROVIDER=null`, no Clerk key). The Showcase and Chloe screens were captured later against a local Postgres seeded with the three demo Showcase entries (`docker compose up` does the same), and Chloe through the fake voice provider, so no microphone was used.

| | |
|---|---|
| ![Landing page](docs/screenshots/landing.png) | ![Chat intake with scenario chips and the brief panel](docs/screenshots/intake.png) |
| Landing page from the approved Stitch export | Intake: chat or form, scenario chips, "Your brief so far" |
| ![Brief review with the two-month calendar](docs/screenshots/brief-review.png) | ![Feasible route: three builder cards with evidence badges, reusable IP, cohort and partner](docs/screenshots/route-feasible.png) |
| Confirm your brief before routing | Feasible route: team, cost strip, reusable IP, cohort, partner |
| ![Why this route? drawer listing the eligible-builder rule and its source facts](docs/screenshots/why-this-route.png) | ![Partial route with the gaps panel above the team](docs/screenshots/route-partial.png) |
| "Why this route?": the named rule and its facts, no model text | Partial route: the gap and its next actions come first |
| ![Partners page from the seed graph](docs/screenshots/partners.png) | ![Plain-text venture handoff](docs/screenshots/handoff.png) |
| Partners, universities, cohorts and reusable IP from the seed graph | Handoff text built client-side from the route |
| ![Public Showcase gallery with three demo entries, skill and vertical filters](docs/screenshots/showcase-gallery.png) | ![Showcase detail: verified skills with Project evidence, links, and about text](docs/screenshots/showcase-detail.png) |
| Builder Showcase: admin-confirmed projects, Demo data pills, filters | Showcase detail: skills shown with their evidence; display-only, never a MeTTa fact |
| ![Chloe voice intake: greeting, brief read-back and a confirmation prompt with a hold-to-talk microphone](docs/screenshots/chloe-voice.png) | |
| Chloe voice intake: reads the brief back and asks before routing; the form is always one click away | |

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

Everything installs inside the repository: `uv` creates `services/engine/.venv`, `pnpm` creates `node_modules` at the root and per package; nothing is written outside the clone except the uv and pnpm caches.

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
docker compose up                    # db (postgres:18), then seed, then engine
```

The one-shot `seed` service runs `alembic upgrade head` and then `scripts/seed_showcase_demo.py`, which writes the Showcase demo entries (Venture Route plus two fictional ones) from `services/engine/seed/showcase_demo.json`; edit that file to change titles or links. The seed is idempotent, touches only its own `demo_data` rows and never changes a route. The engine starts once the seed exits successfully. See `docs/API.md` §Demo seed.

The engine image is `python:3.12-slim` with uv, a non-root user, the migrations, and a health check. The web app is served by Vite locally and by Vercel in deployment (D-27).

### Installation criteria

An install is done when every line below holds. Each comes with the command that proves it.

| Criterion | Check | Expected |
|---|---|---|
| Python 3.12 and uv are on the path | `python --version` and `uv --version` | `3.12.x`; uv `0.8` or later |
| Node 24 and pnpm 9.12 are on the path | `node --version` and `pnpm --version` | `v24.x`; `9.12.x` |
| The engine loaded the MeTTa graph | `curl -s http://127.0.0.1:8000/health` | `"facts_loaded":181,"rules_loaded":7,"hyperon_version":"0.2.10"` |
| The web app reaches the engine | open `http://localhost:5173/route`, pick **Health pilot** | a `feasible` route of three builders for USD 47 an hour |
| The engine suite passes | `cd services/engine && uv run pytest -q` | no failures (marketplace tests skip without `TEST_DATABASE_URL`) |
| The web suite passes | `pnpm -r build && pnpm -r test` | no failures |
| The marketplace store is migrated (optional) | `uv run alembic current` in `services/engine` | the head revision, with `DATABASE_URL` set |

Sign-in screens need the Clerk keys in `.env` (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`); without them the routing flow still works and account screens show "Sign-in is not configured".

## Deploy

The hosted demo is: browser, then the **web app on Vercel**, then the **engine on Render** (FastAPI + Hyperon, Docker), then **Neon** Postgres. **Clerk** handles sign-in. Deploy in this order: Render, then Vercel, then connect them (the engine's `CORS_ORIGINS` and the Clerk production webhook). After setup, every push to `master` redeploys both hosts. The full step-by-step wizard, with the values to collect and the checks to paste back, is [docs/DEPLOY.md](docs/DEPLOY.md); this section does not repeat it.

| Service | Host | URL |
|---|---|---|
| Web app | Vercel | [basix-venture-route.vercel.app](https://basix-venture-route.vercel.app/) |
| Engine (`/health`) | Render | [venture-route-engine.onrender.com/health](https://venture-route-engine.onrender.com/health) |
| Clerk webhook | Render | `https://venture-route-engine.onrender.com/api/webhooks/clerk` (signed by Svix; an unsigned call answers `400`) |

Verified on 2 October 2026 (#142): `/health` answers `200`, and the engine's CORS allows the Vercel origin.

### Install the deploy tools

The Render dashboard Blueprint flow is the primary path, so the Render CLI is optional. The Vercel CLI is needed.

| Tool | Install | Check and log in |
|---|---|---|
| Vercel CLI | `npm i -g vercel` or `pnpm add -g vercel` (any OS) | `vercel --version`, then `vercel login` |
| Render CLI (optional) | macOS: `brew install render-oss/render/render`. Linux or macOS: the install script from the [render-oss/cli](https://github.com/render-oss/cli) repo. Windows: the release binary from [its releases](https://github.com/render-oss/cli/releases) where policy allows, otherwise WSL or the Linux CLI in Docker | `render --version`, then `render login` (in Docker, authenticate with `RENDER_API_KEY` instead) |

On Windows machines with Application Control the native `render.exe` can be blocked; use the dashboard, or the Docker route in [DEPLOY.md section 0.1](docs/DEPLOY.md#01-install-the-tools).

### Demo video and submission

- [docs/demo/SCRIPT.md](docs/demo/SCRIPT.md): the demo video plan and script.
- [SUBMISSION.md](SUBMISSION.md): the hackathon submission text; `uv run python scripts/check_submission.py --final` (in `services/engine`) checks it.
- [apps/web/e2e/demo/README.md](apps/web/e2e/demo/README.md): the Playwright demo harness that records each scene at 1080p (local only, never in CI).

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

### Last recorded CI result

From the last recorded run on `master` (CI run 36971801139 at `3f2d85d`, 2 October 2026); the live status is the CI badge at the top.

| Suite | Result |
|---|---|
| Engine (pytest, real Hyperon runtime, Postgres 18 service container) | 671 passed |
| Web (Vitest) | 364 passed |
| Contracts (Vitest) | 46 passed |
| Playwright, no-key suite against `vite preview` | 28 passed |
| Playwright, Clerk suite (real sign-in, blocking in CI) | 21 passed |
| Lint and types | ruff, `mypy .` strict, TypeScript strict and eslint, Zod ↔ Pydantic schema check, offline-snapshot check |

## Configuration

Copy `.env.example` to `.env`. Every variable any service reads is listed there with a comment; secrets never live in the repo (D-26). The engine reads the repo-root `.env`, then an optional `services/engine/.env` that overrides it, then the process environment. A placeholder value is treated as unset, never as an error.

| Variable | Read by | Purpose |
|---|---|---|
| `DEMO_TODAY`, `MIN_OVERLAP_DAYS` | engine | Frozen demo clock (D-14) and the availability overlap rule (D-08). |
| `ENGINE_DEV_QUERY` | engine | `1` exposes `POST /internal/query`. Never in a deployed engine. |
| `CORS_ORIGINS` | engine | Browser origins allowed to call the engine (D-30); Vite dev and preview by default. |
| `LLM_PROVIDER`, `ANTHROPIC_API_KEY` | engine | `anthropic` with a key uses the official SDK; otherwise the null adapter and the structured form (D-06). |
| `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_INTAKE_MODEL`, `OPENROUTER_EXPLAIN_MODEL` | engine | With `LLM_PROVIDER=openrouter`, intake and résumé skills go to the intake model (reasoning off, strict JSON schema) and the route summary to the explain model (reasoning on); the key and both model slugs are required, otherwise the null adapter (D-53). |
| `VOICE_STT_MODEL`, `VOICE_TTS_MODEL`, `VOICE_TTS_VOICE`, `VOICE_TTS_INSTRUCTIONS`, `VOICE_RATE_LIMIT_PER_MINUTE`, `VOICE_TRUSTED_PROXY_HOPS` | engine | The public `/api/voice/transcribe` and `/api/voice/speak` proxy, reusing `OPENROUTER_API_KEY`; an unset model answers 503. Opt in on the web with `VITE_VOICE_PROVIDER=openrouter` (D-53). |
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

Builders sign in with Clerk and keep a profile, availability, credentials and showcase projects in Postgres. A skill on a profile is `verified` only when a confirmed credential or a confirmed project proves it; a self-described skill is display only and never satisfies `verified-for-skill`. An admin confirms or rejects accounts, credentials and projects; each decision commits, then `reproject()` renders every confirmed builder into the same predicates the seed uses (`confirmed`, `hourly-rate`, `located-in`, `supports-mode`, `available`, `earned`/`proves`, `built`/`demonstrates`, `licensable`/`vertical`) and rebuilds the space. No new predicate and no new rule name; `GET /health` reports the projected atom count as `projected_rows`. Decisions are recorded in `docs/adr/`.

### Named rules

`verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`, `reuse-fit`, `partner-fit`, `route-gap`. Definitions and semantics: `planning/DOMAIN.md`. Source: `services/engine/seed/rules.metta`. `/health` reports `rules_loaded` by asking the space for an equation of each one.

### Repository layout

```text
services/engine/        FastAPI + Hyperon engine (uv, Python 3.12)
  app/api/              /health, /api/route, /api/conversation, /api/scenarios, /api/ecosystem, /api/me/*, /api/builders/*, /api/admin/*, /api/requests*, /api/bookings*, /api/me/dashboard, /api/webhooks/clerk, /internal/query
  app/engine/           MettaRouteEngine, grounded atoms, atom parsing, projection, EngineError
  app/conversation/     orchestrator: merge → missing fields → clarification or route
  app/llm/              LlmAdapter protocol, Anthropic adapter, null adapter
  app/auth/             Clerk JWKS cache, session verification, require_role, Svix webhook
  app/db/               async engine and session dependency (Neon / compose db)
  app/marketplace/      SQLModel tables, repository, verified-skill derivation, booking state machine, slot rules, wire schemas
  app/models/           VentureBrief, VentureRoute, chat and engine result models
  alembic/              migrations (0001_marketplace, 0002 requests/bids/bookings, 0003_showcase, 0004_hourly_pricing); `alembic upgrade head` is the release command
  seed/                 facts.metta, rules.metta, briefs.json (five demo scenarios)
  scripts/              export_schema.py, export_offline_snapshot.py (both have --check)
  tests/                real-runtime, HTTP-seam and database tests
packages/contracts/     Zod schemas + generated JSON Schema mirrored by Pydantic (see its README)
apps/web/               React 19 + Vite PWA (see its README)
docs/                   API.md, PRD.md, adr/, design/ (Stitch prompts), agents/, images/, screenshots/
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
| `brief-health-01` | Health pilot: python, ai-metta, ui-ux; hybrid; USD 50 an hour; reusable IP | `feasible`: Amina Otieno 15 + Daniel Kiptoo 19 + Grace Wambui 13 = USD 47 an hour, `asset-afya-triage`, partner `amani-health` via four hops |
| `brief-agri-01` | Agri marketplace: frontend, backend, domain-research; remote; USD 44 an hour | `feasible`: Wanjiru Mwangi 18 + Lucy Achieng 12 + Fatuma Hassan 10 = USD 40 an hour (Lucy beats Brian Odhiambo, 15, on cost), `asset-shamba-records`, partner `shamba-agri` |
| `brief-constrained-01` | Mobile + Rust, remote, two weeks; USD 38 an hour | `partial`: Zawadi Njoroge (Rust, USD 16 an hour) eligible, `skill` gap for mobile |
| `brief-budget-01` | Health pilot at USD 31 an hour | `partial`: no team, one `budget` gap: "Raise the hourly budget to USD 47" |
| `brief-onsite-01` | Health pilot on-site in Kisumu; USD 50 an hour | `infeasible`: three `location` gaps, no builders, IP or partner (D-23) |

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
| 003 Marketplace | 23 Sep | Clerk roles, Postgres store, profiles and proof, admin confirmation projected into the graph | merged |
| 004 Requests & interviews | 24 Sep | requests published from a route, eligibility-gated bids, interview bookings, founder dashboard | merged |
| 005a Builder Showcase | 25–27 Sep | public showcase of shipped products, certifications and skills, admin-gated, display-only (D-42, D-43) | merged |
| 005 Demo hardening | 28 Sep – 2 Oct | Render + Vercel deploy, demo harness, videos, submission | deployed; demo scenes #147–#149 open |
| 006 Chloe voice intake | folded into 005a | browser-speech voice skin over the unchanged conversation API (D-38, D-51) | merged |

## Limitations and what is next

We would rather state these than have you find them.

- **Demo data only.** Every builder, credential, project, cohort, university and partner is fictional and labelled. No real BASIX integration, personal data, IP ownership claim or partner relationship is represented.
- **No payments, contracting or hiring.** Requests, bids and interview bookings are in-app state only.
- **The language model is optional.** Without a key the engine uses a null adapter and the structured form; routes are identical, because the model never decides them.
- **Hosted deployment** runs on Render (engine) and Vercel (web), both redeploying from `master`. Reprojection latency on the hosted Neon database is a tracked item (issue #51).

**Next:** real BASIX data replacing the seed graph through the existing projection path, voice intake hardening, and richer partner and cohort facts for the rules to reason over. The rule names stay fixed; new facts, not new matchers.

## Team

**ThisisAnfield**: Njuguna Njenga, Anthony Onyango, Naomi Wangui.

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
