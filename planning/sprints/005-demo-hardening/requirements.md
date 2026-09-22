# Sprint 005 — Demo hardening

**Window:** Wed 30 Sep 08:00 → Wed 30 Sep 20:00 EAT; freeze 22:00. **Branch:** `sprint/005-demo-hardening`. **Depends on:** whatever is merged by Wed 30 Sep 08:00.

## Goal
A clean-launch demo that runs all five scenarios from one command, a deployed copy (deployed by the Operator from the Builder's wizard, D-27), a Playwright-recorded demo video and a pitch deck with script (D-28), and a README a judge can follow.

## In scope
1. `docker compose up` brings up `engine`, `db` and `web` with seed data and migrations applied; `README.md` documents prerequisites, `.env.example`, the single launch command, the offline demo flag, and the demo script (five scenarios in order with expected screens).
2. Deploy (D-27): the Builder writes `docs/DEPLOY.md` as a step-by-step wizard — engine Docker image to Railway (Render fallback) with `/health`; web to Vercel with `VITE_API_URL`; Neon `main` branch as the production `DATABASE_URL`, `alembic upgrade head` as the Railway release command; every env var from `.env.example` with where to paste it. The Operator runs the `railway` and `vercel` commands by hand and pastes the public URLs and `/health` responses back; the Builder records them in README. The Builder never runs `railway` or `vercel`.
3. Demo script `docs/DEMO.md`: click-by-click, timings, what to say about each named rule, the judge-facing "change a constraint" moment.
4. Recording (D-28): Playwright CLI records `demo.spec.ts` (the five scenarios in `docs/DEMO.md` order, with the "change a constraint" moment) from a clean `docker compose up` on Codespaces after it passes twice; saved under `docs/demo/` (webm; mp4 if converted) and linked in README; UI shows "Offline demonstration mode" when `VITE_OFFLINE_DEMO=1`.
4b. Pitch deck (D-28): rebuild the existing "Venture Route — Hackathon Pitch Deck.pdf" as a Slides artifact; write `docs/PITCH.md` with a timed script per slide; embed or link the demo video on the demo slide; team member names are a placeholder until the Operator supplies them (Q-08). The Operator records the voice-over.
5. Bug bash: any acceptance line from 000–004 that regressed is fixed here; no new features.
6. Submission checklist in `docs/SUBMISSION.md` (repo link, demo URL, demo video, pitch deck link, `docs/PITCH.md`, PRD, rules/evidence screenshots).

## Out of scope
New features of any kind.
