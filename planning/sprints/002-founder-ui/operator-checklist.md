# Sprint 002 — Operator checklist (human tasks, keys, platform setup)

The Builder never asks for a key in chat (D-26). Everything below is the Operator's to do, by hand or with an **Operator** Claude session (not the Builder session). Every key goes into the git-ignored repo-root `.env`.

## Before Sprint 002 P1 (Fri 25 Sep 08:00 EAT)

| # | Task | How | Done when |
|---|---|---|---|
| 1 | Reset local `master` | `git checkout master && git fetch origin && git reset --hard origin/master`. This discards only the unpushed `/code-review` merge `e08eaec`, whose content is already in the PR. | `git log -1 master` shows `af05d2b` |
| 2 | Merge PR #20 "Sprint 001: Routing core" | GitHub merge button (Architect verdict DONE_WITH_FOLLOW_UPS, `planning/sprints/001-routing-core/review.md`) | PR shows Merged |
| 3 | Merge the Architect planning PR for Sprint 002 (branch `claude/laughing-pascal-bs5cz8`) | After #20. It carries D-29 to D-34 and the finalised Sprint 002 folder. | Sprint 002 folder on `master` has `blueprint.md` |
| 4 | Stitch batch 1 (five screens, §Batch 1 of `docs/design/stitch-prompts.md`) | Export, then commit under `design/stitch/batch-1/` | Due **Thu 24 Sep 18:00**. If it is late, the Builder uses shadcn defaults with the DESIGN.md tokens (the sprint still runs). |
| 5 | Stitch batch 2: only 2.1 Landing and 2.2 Handoff | Commit under `design/stitch/batch-2/`. Skip 2.3 Sign-in until Sprint 003. | By Fri 25 Sep 18:00, so the landing and handoff tickets can use it |
| 6 | GitHub Actions allowed on the repo | Settings → Actions → General → "Allow all actions". **No secrets are needed**: CI runs with `LLM_PROVIDER=null` (D-33). | The first CI run appears on the Sprint 002 PR |
| 7 | *(optional, closes #19)* Real Anthropic key | console.anthropic.com → API keys → paste into `.env` as `ANTHROPIC_API_KEY=` → run the #19 steps and paste the output into PR #20 or #19 | #19 closed |
| 8 | *(optional)* Codespaces `docker compose up engine` + `curl localhost:8000/health` | Paste the output into PR #20 or the Sprint 002 PR | `rules_loaded: 7` pasted |

**No key is required for Sprint 002.** It has no auth, no database and no deploy. Playwright and CI run the engine on `LLM_PROVIDER=null`.

## Keys you need to provide, by sprint

| Variable | Needed by | Where it comes from | Browser-safe? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Optional in 001/002 (#19, live chat), required for the live demo | Anthropic Console → API keys | No (engine only) |
| `CORS_ORIGINS` | 002 (defaults are fine locally); 005 adds the Vercel URL | You type it | n/a |
| `VITE_CLERK_PUBLISHABLE_KEY` (`pk_test_…`) | **003, by Sat 26 Sep 20:00** | Clerk Dashboard → API keys | Yes |
| `CLERK_SECRET_KEY` (`sk_test_…`) | 003 | Clerk Dashboard → API keys | No |
| `CLERK_JWKS_URL` | 003 | Clerk Dashboard → API keys → JWKS URL (`https://<your-frontend-api>/.well-known/jwks.json`) | n/a |
| `CLERK_WEBHOOK_SIGNING_SECRET` (`whsec_…`) | 003 | Clerk Dashboard → Webhooks → your endpoint → Signing secret (see Clerk step 5) | No |
| `ADMIN_EMAILS` | 003 | Your own email(s), comma-separated | n/a |
| `DATABASE_URL` (pooled, Neon `dev` branch) | 003 | Neon Console → Connect → Pooled connection (see the Neon steps for the asyncpg form) | No |
| `TEST_DATABASE_URL` (Neon `test` branch) | 003 | Same, on the `test` branch | No |
| Railway project + public URL | 005 (a smoke deploy in 002 is optional) | railway.com | n/a |
| Vercel project + URL | 005 (an offline-mode preview in 002 is optional) | vercel.com | n/a |

## Clerk (needed by Sat 26 Sep 20:00 for Sprint 003)
Skills that will use it: `clerk-setup`, `clerk-react-patterns` (`@clerk/react`, Vite), `clerk-cli`, `clerk-webhooks`, `clerk-testing`, `clerk-backend-api`, and `fastapi-clean-architecture` (Clerk JWT section). Unused: every other `clerk-*` platform skill and `clerk-billing`/`clerk-orgs`.

1. Dashboard → **Create application** "Venture Route". Sign-in options: Email (code) and optionally Google. Keep the **Development** instance for the whole hackathon.
2. **API keys** page: copy the publishable key, secret key and JWKS URL into `.env`.
3. **Sessions → Customize session token**: add `{"metadata": "{{user.public_metadata}}"}`. Without this the JWT has no role claim and D-03's `require_role` cannot work.
4. **Users**: after you first sign in through the app in Sprint 003, your email in `ADMIN_EMAILS` becomes admin. Nothing else to set by hand.
5. **Webhooks**: a signing secret belongs to an endpoint URL.
   - Sprint 003 (local): the Builder follows the `clerk-cli` skill's local webhook testing. Paste whichever `whsec_` it gives you into `.env`.
   - Sprint 005: create the endpoint `https://<railway-domain>/api/webhooks/clerk` with events `user.created` and `user.updated`, and put that endpoint's secret on Railway.
6. Test users for Playwright (`clerk-testing`): Development instances accept `+clerk_test` emails with code `424242`. There is nothing to create in advance.

Paste-ready **Operator** prompt (Claude Code, repo root, not the Builder session):
```text
Use the clerk-cli skill. Log in to Clerk and select the "Venture Route" application, Development instance. Write VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY and CLERK_JWKS_URL into the repo-root .env (git-ignored). Never echo a secret value in chat; show only the key prefixes (pk_test_, sk_test_) and the JWKS host. Set the session token so it carries {"metadata": "{{user.public_metadata}}"}. If the CLI cannot change the session token, tell me the exact Dashboard path and stop. Finish with `clerk doctor` and paste its output. Do not touch any tracked file.
```

## Neon (needed by Sat 26 Sep 20:00 for Sprint 003)
Skills: `neon-postgres` (connections, pooled vs direct, branches, migrations). The Neon MCP is connected in Claude sessions. Never the Convex skill (D-17).

1. Create the project `venture-route`: Postgres 17, region **AWS eu-central-1 (Frankfurt)**. Put Railway in an EU region to match (step 3 of Railway).
2. Branches: `main` (production, Sprint 005), plus `dev` (Sprint 003–004 `DATABASE_URL`) and `test` (`TEST_DATABASE_URL`) created from `main`. Sprint 005 creates `demo` from `main` for resets.
3. Connection strings: use **Pooled** (host contains `-pooler`) for the app. Convert Neon's default string to the SQLAlchemy asyncpg form:
   - Neon gives `postgresql://neondb_owner:PASS@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
   - `.env` gets `postgresql+asyncpg://neondb_owner:PASS@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?ssl=require`
   - Reason: the asyncpg driver behind SQLAlchemy rejects `sslmode`/`channel_binding` query arguments. The current `.env.example` placeholder shows `sslmode=require`; the Sprint 003 first ticket must prove the connection and fix the example.
4. Also keep the **direct** (non-pooler) string for `dev`. Alembic migrations should run over the direct connection. The Sprint 003 blueprint decides the variable name.

Paste-ready **Operator** prompt:
```text
Use the neon-postgres skill and the Neon MCP. Create project "venture-route" (Postgres 17, aws-eu-central-1) unless it exists. From main, create branches "dev" and "test". For dev and test, fetch the pooled connection string for database neondb. Convert each to postgresql+asyncpg://…?ssl=require (drop sslmode and channel_binding). Write DATABASE_URL (dev) and TEST_DATABASE_URL (test) into the repo-root .env. Never echo passwords in chat; show only the branch names and host names. Then prove each URL with one `select 1` over asyncpg (uv run python -c ... from services/engine) and paste the result. Do not touch any tracked file.
```

## Railway (engine, Sprint 005; optional smoke deploy in Sprint 002)
Skill: `use-railway`. D-27: you run the `railway` commands; the Builder only writes `docs/DEPLOY.md`.

- Now: create an account and install the CLI (`npm i -g @railway/cli`, `railway login`).
- Facts the Sprint 005 wizard will need:
  - The image is `services/engine/Dockerfile`, listening on **port 8000** (hard-coded CMD). Set the variable `PORT=8000`, or pick 8000 as the domain's target port.
  - Health check path is `/health`. Region: EU West.
  - Variables: `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `DEMO_TODAY=2026-09-22`, `MIN_OVERLAP_DAYS=2`, `ENGINE_DEV_QUERY=0`, `CORS_ORIGINS=<vercel url>`. From 003 also `DATABASE_URL`, `CLERK_*` and `ADMIN_EMAILS`.
- *(Optional de-risk, end of Sprint 002, ~20 min)* Paste-ready prompt:
```text
Use the use-railway skill. Walk me through deploying services/engine to Railway as service "engine" in a new project "venture-route" (EU West), from its Dockerfile, with PORT=8000, LLM_PROVIDER=null, DEMO_TODAY=2026-09-22, MIN_OVERLAP_DAYS=2, ENGINE_DEV_QUERY=0 and health check path /health. Give me each railway command to run myself; do not run railway yourself (D-27). After I paste the domain, curl /health and /api/scenarios and report.
```

## Render (fallback only, D-05)
No Render skill is installed, and none is needed. `docker-vps-deploy` is for a plain VPS, not Render.
- Use Render only if Railway fails on demo week: New → Web Service → this repo, Runtime **Docker**, Root Directory `services/engine`, Health Check Path `/health`, the same variables as Railway, plus `PORT=8000`.
- Use a **paid** instance for the demo. The free tier sleeps and cold-starts in about a minute, which would break a live demo.

## Vercel (web, Sprint 005; optional offline preview in Sprint 002)
Skills: `deploy-to-vercel`, `vercel-react-best-practices`. The Vercel MCP is connected in Claude sessions. D-27: you run `vercel` yourself.

- Import the repo with Root Directory `apps/web`, framework preset **Vite**, and pnpm (lockfile at the repo root).
- Environment variables: `VITE_API_URL=<railway url>`, `VITE_CLERK_PUBLISHABLE_KEY` (003+), `VITE_OFFLINE_DEMO=0`.
- The SPA needs an `index.html` rewrite (`apps/web/vercel.json`); Sprint 005 adds it.
- *(Optional, end of Sprint 002)*: a preview deploy with `VITE_OFFLINE_DEMO=1` gives a public, API-free fallback URL (this partly answers Q-06).

## Open questions only you can close
- Q-06: does the submission need a public URL?
- Q-08: team member names.
- Q-09: demo slot length.
