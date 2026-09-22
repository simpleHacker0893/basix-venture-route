# Sprint 005 — Demo hardening

**Window:** Wed 30 Sep 08:00 → Wed 30 Sep 20:00 EAT; freeze 22:00. **Branch:** `sprint/005-demo-hardening`. **Depends on:** whatever is merged by Wed 30 Sep 08:00.

## Goal
A clean-launch demo that runs all five scenarios from one command, a deployed copy, a recorded fallback, and a README a judge can follow.

## In scope
1. `docker compose up` brings up `engine`, `db` and `web` with seed data and migrations applied; `README.md` documents prerequisites, `.env.example`, the single launch command, the offline demo flag, and the demo script (five scenarios in order with expected screens).
2. Deploy: engine Docker image to Railway (Render fallback) with `/health`; web to Vercel with `VITE_API_URL`; Neon `main` branch as the production `DATABASE_URL`, `alembic upgrade head` run from the Railway release command. Public URLs recorded in README.
3. Demo script `docs/DEMO.md`: click-by-click, timings, what to say about each named rule, the judge-facing "change a constraint" moment.
4. Recording: Operator records the full script from a clean launch (Q-07 tool) after it passes twice; file linked in README; UI shows "Offline demonstration mode" when `VITE_OFFLINE_DEMO=1`.
5. Bug bash: any acceptance line from 000–004 that regressed is fixed here; no new features.
6. Submission checklist in `docs/SUBMISSION.md` (repo link, demo URL, recording, PRD, rules/evidence screenshots).

## Out of scope
New features of any kind.
