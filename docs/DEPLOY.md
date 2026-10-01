# Deploy Venture Route: engine on Render, web on Vercel

This is the step-by-step deploy wizard (D-27, D-57, spec #135). It puts the **engine** (FastAPI +
Hyperon, Docker) on **Render** from the committed Blueprint `render.yaml`, and the **web app**
(Vite SPA, `apps/web`) on **Vercel** from the committed `apps/web/vercel.json`. Both read **Neon**
`production` (D-17) and **Clerk** (D-03). After setup, every push to `master` redeploys both.

**Who does what (D-57).** The Operator runs every `render` and `vercel` command that creates or
changes something and types every secret straight into the CLI or the dashboard. The agent only
runs read-only checks (`curl /health`, the CORS check, `render blueprints validate`). A secret
never goes into chat, a tracked file or a terminal echo (D-26).

**How to follow it.** Go top to bottom: [Prerequisites](#0-prerequisites) → [Render](#2-render-the-engine)
→ [Vercel](#3-vercel-the-web-app) → [Connect](#4-connect-the-two) → [Verify](#5-verify).
Each step ends in a **Paste back** box: copy exactly that output (it never contains a secret)
into the chat with the agent before you go on. The same steps run as an interactive script:

```bash
bash scripts/deploy-wizard.sh   # Git Bash on Windows, or any bash
```

Commands are written for **Git Bash** on Windows (or any bash). `read -rs NAME` reads a secret
into the shell without echoing it; nothing is written to disk.

Placeholders used below: `<engine-url>` is the Render URL (`https://venture-route-engine-xxxx.onrender.com`,
no trailing slash), `<web-url>` is the Vercel production URL (`https://….vercel.app`, no trailing
slash), `<srv-id>` is the Render service id (`srv-…`).

---

## 0. Prerequisites

### 0.1 Install the CLIs

| Tool | Windows (PowerShell) | macOS / Linux |
|---|---|---|
| Render CLI | `winget install Render.CLI`, or download the Windows zip from <https://github.com/render-oss/cli/releases> and put `render.exe` on `PATH` | `brew install render-oss/render/render`, or the release binary from the same page |
| Vercel CLI | `npm i -g vercel` | `npm i -g vercel` |
| GitHub CLI | `winget install GitHub.cli` (already used for issues) | `brew install gh` |
| uv | already installed for the engine (`services/engine`) | same |

Check:

```bash
render --version
vercel --version
```

### 0.2 Log in

```bash
render login                 # opens the browser; approve, then come back
render workspaces            # list workspaces
render workspace set         # pick the workspace that will own the engine (interactive)
vercel login
vercel whoami
```

### 0.3 Collect the values (keep them in your password manager, not in a file)

| Value | Where to get it | Form |
|---|---|---|
| Neon pooled URL | Neon console → project `venture_route` → branch `production` → Connect → **Pooled connection** on | Rewrite to the asyncpg form: `postgresql+asyncpg://USER:PASSWORD@HOST-pooler…/DB?ssl=require` (change the scheme, replace `sslmode=require&channel_binding=require` with `ssl=require`; asyncpg rejects `sslmode`) |
| Neon direct URL | Same screen, **Pooled connection** off (host has no `-pooler`) | Same asyncpg form, `?ssl=require` |
| `CLERK_JWKS_URL` | Clerk Dashboard → Venture Route → Development → API keys → JWKS URL (`https://<instance>.clerk.accounts.dev/.well-known/jwks.json`) | public |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys → Secret keys (`sk_test_…`) | secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API keys → Publishable key (`pk_test_…`) | browser-safe |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | secret |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys (also feeds the voice proxy, D-53) | secret |
| `ADMIN_EMAILS` | The Operator's sign-in email(s), comma-separated | not secret, but kept out of git |

The Clerk dev instance (`pk_test`) is fine for the demo (spec #135, out of scope: a production instance).

### 0.4 Check the repo

`render.yaml` must be on `master` (Render reads the Blueprint from the branch it deploys):

```bash
git fetch origin && git show origin/master:render.yaml | head -20
render blueprints validate render.yaml
```

> **Paste back:** the last lines of `render blueprints validate` (expect it to report the
> Blueprint as valid).

---

## 1. Environment variables: which host gets what

Generated from `.env.example` and checked against `render.yaml` (see the comparison in the #138
report). **Engine secrets never go to Vercel.** Only `VITE_*` variables reach the browser, and
they are baked in at build time, so changing one needs a Vercel redeploy.

### 1.1 Render (engine) — set by the Blueprint

Plain values are committed in `render.yaml`; you do nothing for them.

| Variable | Value on Render | Why |
|---|---|---|
| `PORT` | `8000` | the image runs uvicorn on 8000 (replaces the compose-only `ENGINE_PORT`) |
| `DEMO_TODAY` | `2026-09-22` | frozen demo clock (D-14) |
| `MIN_OVERLAP_DAYS` | `2` | D-08 |
| `ENGINE_DEV_QUERY` | `0` | never expose `/internal/query` in a deployed engine |
| `LLM_PROVIDER` | `anthropic` | D-06; `openrouter` is the D-53 alternative |
| `OPENROUTER_INTAKE_MODEL` | `nvidia/nemotron-3.5-lightning` | D-53 |
| `OPENROUTER_EXPLAIN_MODEL` | `openai/gpt-6-luna` | D-53 |
| `VOICE_STT_MODEL` | `openai/gpt-4o-mini-transcribe` | D-53 |
| `VOICE_TTS_MODEL` | `openai/gpt-4o-mini-tts-2025-12-15` | D-53 |
| `VOICE_TTS_VOICE` | `nova` | D-53 |
| `VOICE_TTS_INSTRUCTIONS` | `Warm, clear, unhurried British English.` | D-53 |
| `VOICE_RATE_LIMIT_PER_MINUTE` | `60` | D-53 |
| `VOICE_TRUSTED_PROXY_HOPS` | `1` | one proxy (Render's) in front of the engine (D-57) |

### 1.2 Render (engine) — prompted (`sync: false`), you type them in the dashboard

| Variable | What to enter |
|---|---|
| `DATABASE_URL` | Neon `production` **pooled** URL, asyncpg form, `?ssl=require` |
| `DATABASE_URL_DIRECT` | Neon `production` **direct** URL, asyncpg form; the pre-deploy migration uses it |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `OPENROUTER_API_KEY` | your OpenRouter key (needed for voice even when `LLM_PROVIDER=anthropic`) |
| `CLERK_JWKS_URL` | Clerk JWKS URL |
| `CLERK_SECRET_KEY` | Clerk `sk_test_…` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_replace-me` for now; the real one comes in step 4.2 |
| `ADMIN_EMAILS` | the admin email(s) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` for now; the Vercel origin is added in step 4.1 |

### 1.3 Vercel (web) — Production **and** Preview

| Variable | Value |
|---|---|
| `VITE_API_URL` | `<engine-url>` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk `pk_test_…` |
| `VITE_OFFLINE_DEMO` | `0` |
| `VITE_VOICE_PROVIDER` | `web` |

### 1.4 Local only — never deployed

| Variable | Why it stays local |
|---|---|
| `ENGINE_PORT` | compose host port; Render uses `PORT` |
| `ALEMBIC_DATABASE_URL` | one-off migration override (step 2.5 on the free plan); the Blueprint sets `DATABASE_URL_DIRECT` |
| `TEST_DATABASE_URL` | pytest only |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | the compose `db` service only |

---

## 2. Render: the engine

### 2.1 Choose the plan

**Starter (recommended).** Pre-deploy commands need a paid plan, and Starter does not sleep
before a live demo. The Blueprint says `plan: starter`. For the free plan see
[§7](#7-free-plan-notes) before you continue.

### 2.2 Apply the Blueprint (dashboard)

1. Open <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
2. Connect the GitHub repo `simpleHacker0893/basix-venture-route`, branch `master`. Render finds
   `render.yaml` and shows one web service, `venture-route-engine` (Docker, Ohio, Starter).
3. Render asks for each `sync: false` variable. Type the values from the table in
   [§1.2](#12-render-engine--prompted-sync-false-you-type-them-in-the-dashboard). Paste them
   into the browser field only.
4. Click **Apply**. The first build takes several minutes (the Hyperon image is large).

> **Paste back:** the service URL Render shows (`https://venture-route-engine-….onrender.com`).

### 2.3 Find the service id

```bash
render services -o json
```

Note the `id` (`srv-…`) of `venture-route-engine`. Every command below uses it as `<srv-id>`.

> **Paste back:** the `srv-…` id and the service URL.

### 2.4 Watch the first deploy

```bash
render deploys list <srv-id>
render logs -r <srv-id> --tail
```

On Starter the deploy runs `alembic upgrade head` as its pre-deploy command first (Alembic
resolves `ALEMBIC_DATABASE_URL`, then `DATABASE_URL_DIRECT`, then `DATABASE_URL`), then starts
uvicorn and waits for `/health` to return 200. Stop the log tail with Ctrl-C once you see
`Application startup complete`.

> **Paste back:** the top line of `render deploys list <srv-id>` (status `live`) and any log
> line that says `ERROR` or `Traceback` (none expected).

### 2.5 Migrate by hand (free plan only; skip on Starter)

Run once from the repo, and again after any new migration. The URL is read without echo:

```bash
cd services/engine
read -rs ALEMBIC_DATABASE_URL && export ALEMBIC_DATABASE_URL   # paste the Neon DIRECT URL, then Enter
uv run python -m alembic upgrade head
unset ALEMBIC_DATABASE_URL
cd ../..
```

(`uv run python -m alembic` instead of `uv run alembic` because Windows Application Control
blocks the generated `.exe` shims on this machine.)

> **Paste back:** the last `Running upgrade … -> …` line, or `INFO  [alembic.runtime.migration] Will assume transactional DDL.` with no error.

### 2.6 Health check

```bash
curl -s <engine-url>/health
```

Expected (numbers vary):

```json
{"status":"ok","facts_loaded":…,"rules_loaded":…,"projected_rows":…,"hyperon_version":"0.2.10","demo_today":"2026-09-22"}
```

> **Paste back:** the whole JSON line.

### 2.7 Manual redeploy (whenever you change a variable)

The dashboard's **Save, rebuild and deploy** does it, or:

```bash
render deploys create <srv-id> --wait
```

`--wait` exits non-zero if the deploy fails.

---

## 3. Vercel: the web app

The Vercel project already exists: **`basix-venture-route`** in the team
`simplenjenga4-6645s-projects`, connected to the GitHub repo, production branch `master`.

### 3.1 Fix the project root directory (this is why the preview check fails)

**Root cause of the red "Vercel" check on every PR** (read-only investigation, 2026-10-01):

- `gh pr checks 134` → `Vercel fail … Deployment has failed`. The same failure is on PRs #121,
  #122, #129, #131 and #134.
- `vercel inspect dpl_5PTv2JavTRqcaJfaHjQAoSjzQYzr --logs` (PR #134): install and the turbo
  build both succeed (`Tasks: 2 successful, 2 total`), then
  `Error: No Output Directory named "public" found after the Build completed.`
- The project settings (read with `vercel api /v9/projects/basix-venture-route`) have
  `rootDirectory: null` and `framework: null`, and no environment variables at all.

So Vercel builds from the **repo root**. It never reads `apps/web/vercel.json` (framework `vite`,
the root-relative turbo build, output `dist`, the SPA rewrite). It runs the root `pnpm build`,
then looks for the default `public` folder at the repo root, finds none and fails. Missing
`VITE_*` variables are not the cause: the build passes without them. They only matter at
runtime, and step 3.3 sets them.

**Fix (Operator, one dashboard change):**

1. Open <https://vercel.com/simplenjenga4-6645s-projects/basix-venture-route/settings/build-and-deployment>
   (Project → Settings → Build and Deployment).
2. **Root Directory**: `apps/web` → Save.
3. Leave **Include files outside the root directory in the Build Step** on. It is on now, and the
   build needs it (`cd ../..` and `packages/contracts`).
4. Leave Framework Preset and the Build, Output and Install overrides off. `apps/web/vercel.json`
   sets them.

CLI alternative (beta `vercel api`; check `vercel api --help` first. In Git Bash the
`MSYS_NO_PATHCONV=1` prefix stops the path being rewritten):

```bash
MSYS_NO_PATHCONV=1 vercel api /v9/projects/basix-venture-route -X PATCH -f rootDirectory=apps/web --scope simplenjenga4-6645s-projects
```

The check is fixed in the project settings, not in the repo: the committed config is correct for
a project rooted at `apps/web` (spec #135), and the check is never disabled.

> **Paste back:** a screenshot or the text of the Root Directory field showing `apps/web`.

### 3.2 Link the repo to the project

From the **repo root** (not `apps/web`):

```bash
vercel link --project basix-venture-route --scope simplenjenga4-6645s-projects
```

This writes `.vercel/` (git-ignored). The build settings come from `apps/web/vercel.json`, so
answer no to any offer to override them.

> **Paste back:** the `Linked to …/basix-venture-route` line.

### 3.3 Add the four `VITE_*` variables for Production and Preview

Each command prompts for the value. For Preview, press Enter at the Git-branch question so the
value applies to every preview branch.

```bash
vercel env add VITE_API_URL production                 # <engine-url>
vercel env add VITE_API_URL preview
vercel env add VITE_CLERK_PUBLISHABLE_KEY production   # pk_test_…
vercel env add VITE_CLERK_PUBLISHABLE_KEY preview
vercel env add VITE_OFFLINE_DEMO production            # 0
vercel env add VITE_OFFLINE_DEMO preview
vercel env add VITE_VOICE_PROVIDER production          # web
vercel env add VITE_VOICE_PROVIDER preview
vercel env ls
```

Never add an engine variable (`DATABASE_URL`, `CLERK_SECRET_KEY`, any `*_API_KEY`, …) to Vercel.

> **Paste back:** the output of `vercel env ls` (names and environments only; values are
> shown as `Encrypted`).

### 3.4 Git connection

The project is already connected to `simpleHacker0893/basix-venture-route` (production branch
`master`), so pushes to `master` deploy to production and PR branches get previews. Run this only
if the dashboard (Settings → Git) shows no repository:

```bash
vercel git connect
```

### 3.5 First production deploy

From the repo root:

```bash
vercel --prod
```

It uploads the repo minus `.vercelignore`, builds from `apps/web` and prints the production URL.

> **Paste back:** the `Production: https://…` line and the `Aliased: https://….vercel.app` line.
> That alias is `<web-url>`.

### 3.6 Preview check goes green

Push any commit to an open PR branch, or re-run the latest preview from the dashboard, then:

```bash
gh pr checks <pr-number>
```

> **Paste back:** the `Vercel` line (expect `pass`).

---

## 4. Connect the two

### 4.1 `CORS_ORIGINS` on Render (D-30)

Render dashboard → `venture-route-engine` → Environment → `CORS_ORIGINS` → Edit:

```
<web-url>,http://localhost:5173,http://localhost:4173
```

Exact origin: scheme and host, no trailing slash. **Save, rebuild and deploy.** Preview
deployments have their own hosts, which are not on this list, so the browser on a preview URL
cannot call the engine. That is expected: previews prove the build, and production is the demo.

> **Paste back:** the CORS check from [§5](#5-verify), step 2.

### 4.2 Clerk production webhook

1. Clerk Dashboard → Venture Route → Development → **Webhooks** → **Add Endpoint**.
2. Endpoint URL: `<engine-url>/api/webhooks/clerk`.
3. Subscribe to `user.created` and `user.updated` only → **Create**.
4. On the endpoint page, reveal the **Signing Secret** (`whsec_…`) and copy it.
5. Render dashboard → Environment → `CLERK_WEBHOOK_SIGNING_SECRET` → paste → **Save, rebuild
   and deploy**.

Do not use Clerk's "Send example" test: it would write a fictional user into `production`. The
sign-up in [§5](#5-verify) is the test.

> **Paste back:** "webhook created" and the endpoint URL (no secret).

### 4.3 Clerk: allowed origin and session-token check

1. Add `<web-url>` to the instance's allowed origins through the Clerk Backend API
   (Instance settings → `allowed_origins`; check the field against Clerk's Backend API
   reference before you run it). The secret key is read without echo:

   ```bash
   read -rs CLERK_SECRET_KEY && export CLERK_SECRET_KEY    # paste sk_test_…, then Enter
   curl -s -X PATCH https://api.clerk.com/v1/instance \
     -H "Authorization: Bearer $CLERK_SECRET_KEY" -H "Content-Type: application/json" \
     -d '{"allowed_origins":["<web-url>","http://localhost:5173"]}' -o /dev/null -w "%{http_code}\n"
   unset CLERK_SECRET_KEY
   ```

   Expect `204` or `200`.
2. Check only (already set in Sprint 002): Clerk Dashboard → **Sessions → Customize session
   token** contains `{"metadata": "{{user.public_metadata}}"}`. Without it every role check
   answers 403.

> **Paste back:** the HTTP status code and "metadata claim present".

### 4.4 Showcase seed, once, against Neon `production`

The seed is idempotent and writes only `demo_data=true` rows with fixed ids
(`services/engine/scripts/seed_showcase_demo.py`; compose runs it after `alembic upgrade head`).
Run it from your machine against the **pooled** production URL. The environment variable
overrides `.env`:

```bash
cd services/engine
read -rs DATABASE_URL && export DATABASE_URL     # paste the Neon production POOLED URL, then Enter
uv run python scripts/seed_showcase_demo.py
unset DATABASE_URL
cd ../..
render restart <srv-id>                          # the engine reprojects at start-up (D-15)
```

> **Paste back:** the `[showcase seed] …` line the script prints and the
> `projected_rows` value from `curl -s <engine-url>/health` after the restart (expect it above 0).

---

## 5. Verify

Run all of this before you share the link. The agent can run steps 1 and 2 for you if you
paste `<engine-url>` and `<web-url>`.

1. **Health.**

   ```bash
   curl -s <engine-url>/health
   ```

   Expect `"status":"ok"` and `"demo_today":"2026-09-22"`.

2. **CORS** (the browser's view of the engine):

   ```bash
   curl -i -H "Origin: <web-url>" <engine-url>/health
   ```

   Expected headers:

   ```
   HTTP/2 200        (or HTTP/1.1 200)
   access-control-allow-origin: <web-url>
   access-control-allow-credentials: true
   ```

   Preflight for the routing call:

   ```bash
   curl -i -X OPTIONS <engine-url>/api/route \
     -H "Origin: <web-url>" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type,authorization"
   ```

   Expect `200` with `access-control-allow-origin: <web-url>` and
   `access-control-allow-methods` listing `POST`. If `access-control-allow-origin` is missing,
   `CORS_ORIGINS` does not match `<web-url>` exactly (step 4.1).

3. **A routed demo scenario.** Open `<web-url>`, pick **Health pilot**, route it. Expect the route
   with its gaps and team. A deep link such as `<web-url>/showcase` must load on refresh (the
   SPA rewrite).
4. **Sign-in round trip.** Sign up on `<web-url>` with a fresh email, choose a role, and land on
   the dashboard. In Clerk → Webhooks → the endpoint → Message Attempts, the `user.created`
   attempt shows `200`.
5. **Showcase.** `<web-url>/showcase` lists the seeded entries.

> **Paste back:** the outputs of 1 and 2, and "scenario routed / sign-in OK / webhook 200 /
> showcase populated". The agent records the URLs in README and STATE (#139, #140).

---

## 6. Rollback

**Engine (Render).**

- Dashboard → `venture-route-engine` → Events → an earlier successful deploy → **Rollback**.
- Or by CLI, redeploying a known good commit:

  ```bash
  render deploys list <srv-id>                         # find the last good commit
  render deploys create <srv-id> --commit <sha> --wait
  ```

- Auto-deploy is on, so the next push to `master` deploys again. Make the fix durable with
  `git revert <bad-sha>` on `master`.
- A rollback does not undo a migration: the older image runs against the newer schema. Do not
  run `alembic downgrade` against `production` during the demo; ask the agent first.

**Web (Vercel).**

```bash
vercel ls basix-venture-route            # find the last good production deployment
vercel rollback <deployment-url-or-id>
vercel rollback status
```

After a rollback Vercel stops auto-promoting new production deploys until you promote one again
(`vercel promote <deployment-url-or-id>`, or the dashboard). Check with `vercel promote --help`.

---

## 7. Free-plan notes

- Render free web services **sleep after about 15 minutes idle**. The first request then takes
  **30–60 s** (the cold start loads the Hyperon space). Before a demo, warm it up:
  `curl -s <engine-url>/health` a minute ahead. Starter does not sleep.
- Free services do not run pre-deploy commands. To deploy on free: on a branch, set
  `plan: free` and delete the `preDeployCommand` line in `render.yaml`, update the drift test
  `services/engine/tests/test_deploy_config.py` in the same commit (it asserts the pre-deploy
  command), merge, apply the Blueprint, then run the migration by hand
  ([§2.5](#25-migrate-by-hand-free-plan-only-skip-on-starter)) after every new migration.
- Vercel Hobby is enough for the web app.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel: `No Output Directory named "public" found` | Root Directory is not `apps/web` | Step 3.1 |
| Browser console: CORS error on `<engine-url>` | `CORS_ORIGINS` does not match the origin exactly | Step 4.1, then verify step 2 |
| Every signed-in call answers 403 | session token lacks the `metadata` claim | Step 4.3 check |
| Sign-up works but no `users` row | webhook secret still the placeholder, or the wrong URL | Step 4.2; Message Attempts shows 400/401 |
| `/api/showcase` empty | seed not run, or the engine not restarted | Step 4.4 |
| Marketplace routes answer 503 | `DATABASE_URL` empty or still the placeholder | Re-enter it on Render (asyncpg form, `?ssl=require`) |
| Changed a `VITE_*` value, site unchanged | `VITE_*` is baked at build time | `vercel --prod` again |
| Voice answers 503 | `OPENROUTER_API_KEY` missing on Render | Set it; voice uses it whatever `LLM_PROVIDER` says |
