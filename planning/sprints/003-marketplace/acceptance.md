# Sprint 003 — acceptance

## Must
- [ ] Playwright with Clerk test users: founder, builder, admin each sign in and land on the role's home screen; a builder cannot open `/admin`.
- [ ] Builder creates a profile with availability via the Calendar range picker, one credential, one project (licensable); before admin confirmation the builder is absent from a route that requires that skill.
- [ ] Admin confirms account, credential and project → engine `GET /health` shows `facts_loaded` increased → the same route now includes the builder with evidence `both`.
- [ ] Admin rejects the project → after reprojection the builder's evidence is `credential` only.
- [ ] Self-described skill on a profile renders "Self-described · display only" and never verified.
- [ ] Every Convex document has `demoData: true` (schema validator + test).
- [ ] `ADMIN_EMAILS` bootstrap test: a user whose email is listed becomes admin on first sign-in.
- [ ] `npx convex dev --once` typechecks; `pnpm -r test`, Playwright, `uv run pytest -q` green; `STATE.md` updated.

## Should
- [ ] Contact-sharing toggles honoured on the founder's candidate view.
- [ ] Reprojection latency < 3 s on demo-size data (pasted timing).
