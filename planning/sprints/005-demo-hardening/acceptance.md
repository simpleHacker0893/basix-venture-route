# Sprint 005 — acceptance

## Part A — Showcase (PR "Sprint 005a: Showcase")

### Must
- [ ] `alembic upgrade head` applies `0003_showcase` clean on the compose `db` and on the CI `postgres:18` service. `alembic downgrade -1 && alembic upgrade head` also runs clean.
- [ ] A builder saves showcase details on a confirmed project → `showcase_status = pending`. The entry is absent from `GET /api/showcase` until an admin confirms it, and present after. An edit sends it back to `pending` and it leaves the list (pytest at the HTTP seam).
- [ ] Visibility table test: each of project not confirmed / project rejected / account unconfirmed / `showcased = false` / showcase rejected hides the entry from the list and gives 404 on detail.
- [ ] URL validation table test: `http://`, `localhost`, IP literal, > 500 chars, and a non-YouTube `pitchVideoUrl` → 422 with the field name. `youtu.be/<id>`, `watch?v=<id>&t=30s`, `shorts/<id>` → the right `videoId`.
- [ ] Display-only invariant: `render_program()` over the demo rows is byte-equal before and after a builder adds showcase details, a skill-less certification and self-described skills. The Constrained brief route is unchanged (D-43).
- [ ] `GET /api/showcase` and `GET /api/showcase/{id}` answer 200 without a token. `PUT /api/me/projects/{id}/showcase` on another builder's project → 404, and without a token → 401.
- [ ] Web (RTL + Playwright no-key suite with a stubbed engine response):
  - **Showcase** appears in the header;
  - `/showcase` renders cards with the Demo data pill and filters by skill;
  - the detail page shows no iframe until "Play pitch" is clicked, then an iframe with a `youtube-nocookie.com/embed/<id>` src;
  - external links carry `rel="noopener noreferrer"`.
- [ ] Clerk suite: builder adds a showcase entry → admin confirms it in the `/admin` Showcase tab → a signed-out visitor sees it on `/showcase`.
- [ ] Contracts: Zod mirrors for the showcase card, detail, editor body and the extended credential; the parity test is green.
- [ ] `uv run pytest -q`, ruff, `uv run mypy .`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` green; CI green on the PR head; `STATE.md` updated.

### Should
- [ ] The skill picker suggests the nine vocabulary skills, accepts free text, and ignores case-insensitive duplicates (RTL).
- [ ] `/admin` can reverse a confirm or reject (#49), including showcase rows.

## Part B — Demo hardening (PR "Sprint 005: Demo hardening")

### Must
- [ ] From a fresh clone: `cp .env.example .env`, `docker compose up` → web at `http://localhost:5173`, engine `/health` 200, all five scenarios produce the expected status and gaps, and `/showcase` lists the demo entries. Evidence: Playwright `demo.spec.ts` run against the compose stack, output pasted.
- [ ] The Railway engine URL returns `/health` 200. The Vercel URL loads the landing page, routes the Health pilot against the Railway engine, and shows `/showcase`.
- [ ] The recording file exists, is linked from README, and shows the real runtime (`/health` visible in the recording).
- [ ] The Operator completes the `docs/DEMO.md` walkthrough twice from a clean launch and signs off in the PR.
- [ ] Every merged sprint's acceptance suite is still green in CI on the freeze commit.
- [ ] #51 is closed with a measurement, plus either a fix or a DECISIONS entry.
- [ ] `STATE.md` says "frozen for demo" with the commit SHA; tag `v0.1.0-demo` exists.

### Should
- [ ] Lighthouse: the PWA is installable on the Vercel URL.
