# Sprint 005 — acceptance

## Must
- [ ] From a fresh clone: `cp .env.example .env`, `docker compose up` → web at `http://localhost:5173`, engine `/health` 200, all five scenarios produce the expected status and gaps (Playwright `demo.spec.ts` run against the compose stack, output pasted).
- [ ] Railway engine URL returns `/health` 200; Vercel URL loads the landing page and routes the Health pilot against the Railway engine.
- [ ] Recording file exists, is linked from README, and shows the real runtime (`/health` visible in the recording).
- [ ] `docs/DEMO.md` walkthrough completed twice by the Operator from a clean launch (Operator signs off in the PR).
- [ ] Every merged sprint's acceptance suite still green in CI on the freeze commit.
- [ ] `STATE.md` says "frozen for demo" with the commit SHA.

## Should
- [ ] Lighthouse PWA installable on the Vercel URL.
