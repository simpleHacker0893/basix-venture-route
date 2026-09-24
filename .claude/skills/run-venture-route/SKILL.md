---
name: run-venture-route
description: Run, start, launch, smoke-test or screenshot Venture Route locally (FastAPI + Hyperon engine and the Vite React web app) and drive it in Chromium: route a demo scenario (Health pilot, Constrained brief, Agri marketplace, Delivery-mode challenge), check /health, or screenshot any page. Use when asked to run the app, see a change working in the real app, or take a screenshot.
---

# Run Venture Route

Venture Route has two processes: the engine (FastAPI with Hyperon in-process, `services/engine`) and the web app (Vite + React, `apps/web`). You start both in the background, then drive them with `.claude/skills/run-venture-route/driver.mjs`. The driver uses the Playwright Chromium that `apps/web` already depends on, so it clicks through the real founder flow and saves screenshots.

All paths are relative to the repo root. Verified on Windows 11 with Git Bash (the Bash tool) on 2026-09-24.

## Prerequisites (once per checkout or worktree)

```bash
cp ../basix-venture-route/.env .env        # a worktree has no .env; copy the Operator's (gitignored, never print it)
(cd services/engine && uv sync -q)
pnpm install --frozen-lockfile              # ~1.5 min cold
pnpm --filter @venture-route/contracts build
```

On a fresh clone with no Operator `.env`, use `cp .env.example .env`. The routing flow works with placeholders because the engine falls back to the null LLM adapter and a no-store mode.

## Run (agent path)

Use ports 8010 and 5183 so you never collide with a human's `pnpm dev` on 8000 and 5173 (see Gotchas). Start each process with the Bash tool's `run_in_background`:

```bash
# engine: python -m, never the uvicorn.exe stub; CORS must list the web origin
cd services/engine && CORS_ORIGINS=http://localhost:5183 uv run python -m uvicorn app.main:app --port 8010 > /tmp/vr-engine.log 2>&1
```
```bash
# web: VITE_API_URL points both the browser and the dev proxy at the engine
cd apps/web && VITE_API_URL=http://localhost:8010 pnpm exec vite --port 5183 --strictPort > /tmp/vr-web.log 2>&1
```

Wait for the engine, then drive. **Always redirect the driver's output to a file and cat it** (see Gotchas):

```bash
node .claude/skills/run-venture-route/driver.mjs health > /tmp/vr-drive.log 2>&1; cat /tmp/vr-drive.log
# 200 {"status":"ok","facts_loaded":181,"rules_loaded":7,...,"hyperon_version":"0.2.10"}

timeout 90 node .claude/skills/run-venture-route/driver.mjs route "Constrained brief" --out .run-shots > /tmp/vr-drive.log 2>&1; cat /tmp/vr-drive.log
# api 200 .../api/route · status: Partial · builders: [ 'Zawadi Njoroge' ] · gaps: [ 'route-gap Skill Affected: mobile ...' ]

timeout 90 node .claude/skills/run-venture-route/driver.mjs shot partners --out .run-shots > /tmp/vr-drive.log 2>&1; cat /tmp/vr-drive.log
```

Driver commands:
- `health` fetches the engine's `/health`.
- `route "<label>"` goes to `/route`, clicks "Load scenario: <label>", waits for "Confirm your brief", clicks "Find my route", waits for "Your route through BASIX", then prints the status badge, builder names and gaps and saves `route-<label>.png`. Labels: `Health pilot` (Feasible: Amina Otieno, Daniel Kiptoo, Grace Wambui, USD 370 / day), `Constrained brief` (Partial, `mobile` skill gap), `Agri marketplace`, `Delivery-mode challenge`.
- `shot <path>` takes a full-page screenshot of any route and prints the first 400 characters of text, for example `shot partners` or `shot showcase`.
- Every command logs `api <status> <url>` for engine calls, `request-failed:` and `console-error:`. It exits 1 with `driver-error:` on a timeout.
- Options: `--base` (web, default `http://localhost:5183`), `--api` (engine, default `http://127.0.0.1:8010`), `--out` (default `./.run-shots`).

**Look at the PNG** with the Read tool. A yellow "The routing engine could not be reached." banner means the run failed, even when the page renders.

Stop the servers with TaskStop on the two background task ids.

## Run (human path)

Per the README: `uv run python -m uvicorn app.main:app --reload` in `services/engine` (port 8000), then `pnpm --filter web dev` (port 5173, where the dev proxy sends `/api` to 8000). Open http://localhost:5173/route and pick a scenario chip.

## Gotchas

- **`uv run uvicorn` fails**: `Failed to spawn: uvicorn ... An Application Control policy has blocked this file. (os error 4551)`. Windows Application Control blocks freshly installed `.exe` stubs in a new `.venv`. Always use `uv run python -m uvicorn` (the same applies to pytest: `python -m pytest`).
- **Setting `VITE_API_URL` makes the browser call the engine directly**, not only through the Vite proxy, because `apps/web/src/api/source.ts` uses it as the API base. The engine's default `CORS_ORIGINS` allows only `:5173` and `:4173`, so on any other web port every fetch fails. The page still renders, with the "could not be reached" banner and no `api` lines in the driver log. Fix: start the engine with `CORS_ORIGINS=http://localhost:<web port>`. `curl` through the proxy (`localhost:5183/api/...`) works either way, so a green curl proves nothing here.
- **Ports 8000 and 5173 are often already taken** by a human's or another session's servers from the main checkout (`basix-venture-route`), possibly on an older branch. Check with `netstat -ano | grep -E ":(8000|5173) " | grep LISTEN` and don't kill them. Use 8010 and 5183.
- **Driver output piped straight to the Bash tool can vanish.** The run either hangs past the tool timeout or ends with `exit 127` after the first line. Redirecting to a file (`> log 2>&1; cat log`) and wrapping in `timeout 90` is reliable.
- **Git Bash rewrites `/partners` into `C:/Program Files/Git/partners`**, giving `Cannot navigate to invalid URL`. Pass page paths without the leading slash (`shot partners`); the driver adds it.
- **The first page load in dev mode takes about 30–60 s** while Vite bundles dependencies (`[optimizer] bundling dependencies...` in the web log). The driver's 30 s timeout can expire on the very first run; rerun it.
- **`tasklist | grep` hangs in Git Bash.** To look up a PID, use the PowerShell tool: `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`.
- **Signed-in screens** (`/profile`, `/admin`, `/dashboard`) need a real Clerk session and aren't covered by this driver. The Clerk Playwright suite (`apps/web/e2e/clerk/*`, engine 8001, preview 4175) is the harness for those.
- `projected_rows: 0` in `/health` is normal when no marketplace rows are confirmed. The five scenarios run from the seed graph.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `os error 4551` spawning `uvicorn` | `uv run python -m uvicorn ...` |
| "The routing engine could not be reached." banner, no `api` lines | Restart the engine with `CORS_ORIGINS=http://localhost:5183` |
| `locator.click: Timeout 30000ms exceeded` waiting for `Load scenario: ...` | Same CORS cause (the scenario chips come from `/api/scenarios`), or Vite's first-load bundling: check `/tmp/vr-web.log` and rerun |
| `Cannot navigate to invalid URL ... C:/Program Files/Git/...` | Drop the leading slash from the `shot` path |
| Driver prints nothing or `exit 127` | Redirect to a file and `cat` it; add `timeout 90` |
