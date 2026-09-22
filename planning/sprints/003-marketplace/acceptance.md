# Sprint 003 — acceptance

## Must
- [ ] Playwright with Clerk test users: founder, builder, admin each sign in and land on the role's home screen; a builder gets 403 on `/api/admin/pending` and is redirected away from `/admin`.
- [ ] Builder creates a profile with availability via the Calendar range picker, one credential, one project (licensable); before admin confirmation the builder is absent from a route that requires that skill.
- [ ] Admin confirms account, credential and project → `GET /health` shows `projected_rows` increased → the same route now includes the builder with evidence `both`.
- [ ] Admin rejects the project → after reprojection the builder's evidence is `credential` only.
- [ ] Self-described skill on a profile renders "Self-described · display only" and never verified.
- [ ] Every table has `demo_data` defaulting to true with a check constraint (migration test).
- [ ] `ADMIN_EMAILS` bootstrap test: a webhook `user.created` for a listed email yields role `admin`, `confirmed = true`; webhook with a bad signature → 400.
- [ ] `alembic upgrade head` runs clean on an empty Neon branch and on the compose `db`; `uv run pytest -q` (including marketplace tests against `TEST_DATABASE_URL`), `pnpm -r test`, Playwright green; `STATE.md` updated.

## Should
- [ ] Contact-sharing toggles honoured on the founder's candidate view.
- [ ] Reprojection latency < 3 s on demo-size data (pasted timing).
