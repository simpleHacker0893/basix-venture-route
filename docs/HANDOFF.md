# Handoff

The state of Venture Route on **2 October 2026**, at `master` `3f2d85d`, written for whoever runs it next: the Operator (Njuguna Njenga) or an agent working for them. It covers what is live, how a change reaches production, how to prove production is healthy, and what is still open. How to build and run the project is in the [README](../README.md); this file points there instead of repeating it.

**Team ThisisAnfield:** Njuguna Njenga, Anthony Onyango, Naomi Wangui.

## What is live

| Piece | Host | URL | Built from |
|---|---|---|---|
| Web app | Vercel | <https://basix-venture-route.vercel.app/> | `apps/web/vercel.json`, `.vercelignore` |
| Engine (FastAPI + Hyperon) | Render | <https://venture-route-engine.onrender.com> | `render.yaml`, `services/engine/Dockerfile` |
| Clerk webhook | Render | `https://venture-route-engine.onrender.com/api/webhooks/clerk` | `services/engine/app/api/webhooks.py` |
| Database | Neon | project `venture_route`, PostgreSQL 18 | `services/engine/alembic/` |
| Sign-in | Clerk | the Clerk dashboard | D-03 |

Demo videos: [Venture Route](https://youtu.be/jCPnXxG3vuU) · [Venture Route demo](https://youtu.be/dTo9q6tkUmU) · [Team demo](https://youtu.be/jQxrl5ooeQg). Pitch deck: <https://canva.link/venture-route>.

## Where the secrets live

Secret values never enter the repository (D-26). The names, and where each one is set:

| Place | Holds | Source of the names |
|---|---|---|
| Render, service `venture-route-engine`, Environment | `DATABASE_URL`, `DATABASE_URL_DIRECT`, `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ADMIN_EMAILS`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | `render.yaml` (keys marked `sync: false`) |
| Vercel, project `basix-venture-route`, Environment Variables | `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_VOICE_PROVIDER` | README §Configuration |
| GitHub, repository secrets | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWKS_URL` for the blocking Clerk e2e step | `.github/workflows/ci.yml` |
| Local `.env` (git-ignored) | everything above, for a development instance | `.env.example` |

A test (`services/engine/tests/test_deploy_config.py`) fails when `render.yaml`, `.env.example` and the engine's `Settings` drift apart. Add a new setting to all three.

## How a change ships

1. Open a pull request against `master`. CI (`.github/workflows/ci.yml`) runs the `engine` job and the `web` job, plus the Chloe contract check (D-51) on pull requests. Vercel posts a preview deployment.
2. Merge once every check is green. The CI badge on the README tracks `master`.
3. Vercel rebuilds the web app from `master`. Render rebuilds the engine from `master` (`autoDeploy: true`) and runs `alembic upgrade head` before the new instance takes traffic. On the free plan pre-deploy commands do not run: apply migrations by hand (see `render.yaml`, top comment).
4. Run the production check below. A deploy is done when every row passes.

## Production check

Run after every deploy, and whenever something looks wrong.

```bash
E=https://venture-route-engine.onrender.com
W=https://basix-venture-route.vercel.app
curl -s $E/health                                                     # 1
curl -s -o /dev/null -w "%{http_code}\n" $W/                          # 2
curl -s -o /dev/null -D - -X OPTIONS $E/health \
  -H "Origin: $W" -H "Access-Control-Request-Method: GET" | grep -i allow-origin   # 3
curl -s -X POST $E/api/webhooks/clerk -H "Content-Type: application/json" -d '{}'  # 4
```

| # | Passes when | Last result (2 Oct 2026) |
|---|---|---|
| 1 | `"status":"ok"`, `"facts_loaded":181`, `"rules_loaded":7` | pass |
| 2 | `200` | pass |
| 3 | `access-control-allow-origin: https://basix-venture-route.vercel.app` | pass |
| 4 | `{"detail":"invalid webhook signature"}`: the route is live and rejects unsigned calls | pass |
| 5 | In the Clerk dashboard, Webhooks → the endpoint → Testing, a `user.created` event shows `200` | **not yet confirmed** |

Row 5 is the only proof that `CLERK_WEBHOOK_SIGNING_SECRET` on Render matches the endpoint. A `400` there means the secret differs: copy it again from that endpoint, save, and let Render redeploy.

## Open work

| Item | Kind | Next step |
|---|---|---|
| Sprint 007 hourly pricing (D-59, spec #157) | sprint | Every price becomes per hour: builder and bid rates USD 0–50, brief and request budgets USD 1–250 for the team, migration `0004_hourly_pricing` converts stored figures (÷ 8, half up). Tickets #158–#161 on `sprint/007-hourly-pricing`, draft PR #164. After merge, the Render deploy applies `0004` (`preDeployCommand: alembic upgrade head`; on the free plan run it by hand, see `render.yaml`); then check that the Health pilot routes `feasible` at USD 47 an hour. Sprints 008 (admin review, D-60) and 009 (admin communication, D-61) build on it. |
| Clerk webhook signed delivery | check | Production check row 5. |
| #147 Builder demo scenes | agent ticket | Not started. Extends the harness in `apps/web/e2e/demo/` (spec #143, D-58). |
| #148 Connect demo scenes | agent ticket | Not started. Depends on #147. |
| #149 Final MP4 | agent ticket | Not started. Depends on #148. The three YouTube videos above may make it unnecessary: decide, then close it or build it. |
| #151 Narration, upload, final submission | Operator | `SUBMISSION.md` is filled and passes `check_submission.py --final`; paste it into the form. |
| #143, #135 | spec tickets | Close each once its child tickets are closed or dropped. |
| #132, #133 | duplicate tickets | The partners section and footer shipped in `af7b73e`. Verify on the live site, close one as completed and the other as a duplicate. |
| #51 Reprojection latency on Neon | performance | 6.1 s against a 3 s target. Measure on the live engine before choosing a fix. |
| #19 Live-key Health pilot run | optional | Run once with a real LLM key. |
| #123 OpenRouter spec | spec ticket | The work merged in #134; close it if nothing is left. |
| Showcase seed links | data | `services/engine/seed/showcase_demo.json` still points the Venture Route entry at `example.org`. Set `liveUrl` to the Vercel URL and `pitchVideoUrl` to a YouTube link, then reseed. The web test fixtures copy those values, so update `apps/web/test/fakeMarketplace.ts` and `apps/web/e2e/showcase.spec.ts` in the same change. |

## Records that are behind the code

- `planning/STATE.md` is dated 29 September. It does not record the deploy, PRs #134 and #152–#154, or this handoff. Refresh it from this file.
- D-54 in `planning/DECISIONS.md` is marked "Proposed" and "not in the demo build", but builder `/home` and the role-first sign-in are on `master` (`f650a4c`, merged in PR #129; sign-in fixes in #152). Mark it Active.

## Local machine notes

- Finished work sits in many local branches and worktrees under `C:\w\` (`demo-t*`, `sprint/005a/t*`). All of it is merged into `master`. Remove them with `git worktree remove` and `git branch -d` once nothing local is unsaved.
- The Windows quirks (workflow pushes over SSH, short worktree paths, serial Vitest) are listed under "Windows notes" in `planning/STATE.md`.

## Read next

`AGENTS.md` (the rules every change follows), then `planning/DECISIONS.md`, `planning/DOMAIN.md`, and [docs/DEPLOY.md](DEPLOY.md) for rebuilding the hosts from scratch.
