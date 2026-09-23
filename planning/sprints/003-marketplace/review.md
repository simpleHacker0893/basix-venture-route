# Sprint 003 — Architect Builder Review (2026-09-23, PR #48 head `a0f7374`)

## Verdict: NOT_DONE (code complete; three Must lines lack evidence)

Re-run by the Architect in a clean worktree of `origin/sprint/003-marketplace` with a local PostgreSQL 16 as `TEST_DATABASE_URL`:

| Check | Result |
|---|---|
| `uv run alembic upgrade head` on an empty database | clean; 9 tables (`alembic_version`, `users`, `profiles`, `credentials`, `skills`, `projects`, `project_skills`, `availability`, `confirmations`) |
| `demo_data` check constraints | 8 (one per table) |
| `uv run pytest -q` with `TEST_DATABASE_URL` | 210 passed |
| `uv run pytest -q` without a database | 132 passed, 78 skipped (marketplace tests skip cleanly) |
| `uv run ruff check .`, `uv run mypy .` | clean, 81 files |
| `export_schema.py --check`, `export_offline_snapshot.py --check` | up to date |
| `pnpm -r typecheck`, `pnpm -r test` | clean; contracts 17, web 59 Vitest |
| CI on PR head (run 35867001711) | engine and web jobs green |
| Tickets | #37–#46 closed with RED/GREEN evidence; #47 open; spec #35 open |

## Acceptance lines
| Line | Status | Evidence |
|---|---|---|
| Playwright three roles, builder 403 on `/api/admin/pending` | ❌ not run | Ticket #47 open; needs Clerk test users locally. HTTP seam tests cover the 403. |
| Builder profile + credential + project, absent before confirmation | ❌ e2e not run | Covered at the HTTP seam in `test_admin_queue.py`; the browser flow is #47. |
| Confirm → `projected_rows` up → route includes builder `both` | ✅ at the HTTP seam | `test_admin_queue.py`: `naomi-chebet` joins the Constrained route with `both`; reprojection 241 ms. |
| Reject project → evidence `credential` | ✅ at the HTTP seam | same file |
| Self-described renders display-only | ✅ | web Vitest (`profile.test.tsx`) |
| `demo_data` default + check on every table | ✅ | 8 constraints, migration test |
| `ADMIN_EMAILS` bootstrap; bad signature → 400 | ✅ | `test_webhook.py` |
| `alembic upgrade head` on an empty **Neon** branch; full suite; Playwright; STATE.md | ❌ partial | Clean on local Postgres; Neon URLs are still placeholders (Operator); Playwright with Clerk users not run; STATE.md not yet updated for the sprint end. |
| Should: contact-sharing toggles | ✅ | `test_candidate.py`, `candidate.test.tsx` |
| Should: reprojection < 3 s | ✅ | 241 ms |

## To reach DONE
1. Operator: rotate the `neondb_owner` password (it was printed in a Builder log), write `DATABASE_URL`, `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL` into `.env` in the `?ssl=require` form, then `uv run alembic upgrade head` against the Neon `test` branch and paste the output on #47.
2. Operator: Clerk Dashboard → Sessions → Customize session token → `{"metadata": "{{user.public_metadata}}"}`; without it every role check returns 403 in the browser.
3. Builder: ticket #47 (Playwright with `+clerk_test` users, code 424242), STATE.md, then P5 with the completion report replacing the PR body.

## Findings outside acceptance
- **Scope on the sprint branch.** Commit `8060610` adds a Sprint 006 "Chloe voice intake" planning pack and decision D-38, and `f04ede7` commits an 89k-line `graphify-out/graph.json`. Neither is Sprint 003 work. Both were Operator-directed and are accepted, but planning artefacts belong in an Architect PR, not a sprint PR; from Sprint 004 on, keep them separate so a sprint PR is reviewable.
- **Postgres major version.** D-37 pins `postgres:18` to match Neon. The Architect review ran on 16; the Alembic migration uses no 18-only feature. Fine.
- **Security.** Hand-rolled Svix verification (#39) is tested for bad signature and timestamp skew. Keep the `svix` package as a follow-up only if the demo endpoint goes public on Railway.
- **Clerk placeholder for the webhook secret** stays until local forwarding; expected.

## What Sprint 004 inherits
- Auth: `app/auth/clerk.py` (`current_user`, `require_role(*roles)`), `app/db/session.py:get_session`, `app/auth/webhook.py`.
- Store: `app/marketplace/{models,repo,schemas,verification}.py`; migration `0001_marketplace.py`; conftest with `migrated_database` and per-test rollback; tests skip without `TEST_DATABASE_URL`.
- Projection: `app/engine/projection.py:reproject(engine, session) -> int`; `/health.projected_rows`.
- Routing: `app/routing/route_service.py` (`status_for`, route building); eligibility for one builder must be added as a function on the route service in Sprint 004 (see blueprint).
- Web: `src/auth/{AuthProvider,RequireRole,authContext,config}`, features `admin`, `builder`, `candidate`; routes `/profile`, `/profile/projects/new`, `/builders/:id`, `/admin`; bearer token in `api/client.ts`.
