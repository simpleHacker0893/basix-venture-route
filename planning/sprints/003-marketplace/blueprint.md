# Sprint 003 — blueprint (finalised 2026-09-23 after the Sprint 002 merge, PR #33)

## Inherited from Sprints 001–002 (read before slicing)
- Engine: FastAPI app in `services/engine/app/main.py` with lifespan-created `MettaRouteEngine`, `Settings` in `app/config.py` (pydantic-settings, reads repo-root `.env` then `services/engine/.env`), CORS from `CORS_ORIGINS` (D-30), `POST /api/route`, `POST /api/conversation`, `GET /api/scenarios`, `GET /health`. Tests: pytest, ruff, `mypy .` strict over app, tests and scripts.
- Web: `apps/web` React 19 + Vite + Tailwind v4 + shadcn (D-25), routes `/`, `/route`, `/handoff`, API client in `src/api/client.ts` (Zod-parses every response), state in `src/state/routing.ts`, features under `src/features/*`, Playwright suite in `apps/web/e2e` against `vite preview` + engine on `LLM_PROVIDER=null`, CI in `.github/workflows/ci.yml` (D-33). Stitch downloads under `design/stitch/` win over the prompt pack (D-36).
- Compose today has only `engine`. This sprint adds `db` (postgres:16, healthcheck) and wires `DATABASE_URL` for compose.
- Store: Neon Postgres via SQLModel + Alembic + asyncpg (D-17). Roles from the Clerk JWT `metadata` claim (D-03; the Operator adds `{"metadata": "{{user.public_metadata}}"}` to the session token). Projection is an in-process full rebuild after every confirmation commit (D-15).

## Files
```
docker-compose.yml                                   # + db service (postgres:16, healthcheck), engine depends_on db healthy
.env.example                                         # DATABASE_URL / TEST_DATABASE_URL use ?ssl=require (asyncpg), plus DATABASE_URL_DIRECT for Alembic
services/engine/pyproject.toml                       # + sqlmodel, sqlalchemy[asyncio], asyncpg, alembic, pyjwt[crypto], httpx (svix verification done by hand or `svix` package)
services/engine/alembic.ini, alembic/env.py, alembic/versions/0001_marketplace.py
services/engine/app/db/session.py                    # async engine from DATABASE_URL; session dependency
services/engine/app/marketplace/models.py            # SQLModel tables: users, profiles, skills, credentials, projects, project_skills, availability, confirmations (all with demo_data bool default true + CHECK demo_data)
services/engine/app/marketplace/repo.py              # queries used by API and projection
services/engine/app/marketplace/verification.py      # verified-skill derivation identical to the projection's inputs
services/engine/app/auth/clerk.py                    # JWKS fetch + cache, verify_session_jwt, current_user, require_role
services/engine/app/auth/webhook.py                  # Svix signature check, user.created / user.updated upsert, ADMIN_EMAILS bootstrap
services/engine/app/api/me.py, builders.py, admin.py, webhooks.py
services/engine/app/engine/projection.py             # reproject(engine, session): seed facts + confirmed rows → atoms; returns projected_rows
services/engine/app/api/health.py                    # + projected_rows
services/engine/tests/conftest.py                    # TEST_DATABASE_URL fixture, per-test transaction rollback; test JWKS + fake JWT signer
services/engine/tests/test_auth.py, test_webhook.py, test_me_profile.py, test_projects.py, test_admin_queue.py, test_projection.py, test_migration_demo_data.py
apps/web/src/auth/ClerkProvider.tsx, RequireRole.tsx # @clerk/react, role from user.publicMetadata.role
apps/web/src/api/client.ts                           # + bearer token from Clerk getToken() on /api/me, /api/admin, /api/builders
apps/web/src/features/auth/SignInScreen.tsx, RoleSelect.tsx        # screen 2 (Stitch export wins, D-36)
apps/web/src/features/profile/*                      # screen 8
apps/web/src/features/projects/*                     # screen 9
apps/web/src/features/candidate/*                    # screen 12
apps/web/src/features/admin/*                        # screen 14
apps/web/e2e/auth.spec.ts, marketplace.spec.ts       # Clerk test users (+clerk_test emails, code 424242)
```

## Steps (tickets in this order)
1. **DB foundation**: compose `db`, async session, Alembic 0001 with every table carrying `demo_data` default true + CHECK, `.env.example` fixed to `?ssl=require` and `DATABASE_URL_DIRECT`; test proves `alembic upgrade head` on an empty database and the constraint.
2. **Clerk verification seam**: `verify_session_jwt` against a JWKS (test JWKS generated in conftest), `current_user`, `require_role`; 401 on bad issuer/expiry, 403 on wrong role, never 500.
3. **Webhook**: Svix-signed `POST /api/webhooks/clerk`, idempotent upsert, `ADMIN_EMAILS` bootstrap, bad signature → 400.
4. **Profile + availability API** (`/api/me/profile` GET/PUT, `/api/me/role` POST once) with the verified-skill derivation.
5. **Credentials + projects API** (`/api/me/credentials`, `/api/me/projects`).
6. **Admin queue API** (`/api/admin/pending`, confirm/reject) calling `reproject()` after commit; `GET /health.projected_rows`; projection test: confirm → route includes the builder with `both`; reject → `credential`.
7. **Candidate view API** (`/api/builders/{id}`) honouring sharing toggles.
8. **Web: Clerk provider, sign-in screen, role select, role-gated routes** (screen 2).
9. **Web: profile + projects screens** (8, 9) with the Calendar range picker reused from the brief form.
10. **Web: candidate profile + admin queue screens** (12, 14).
11. **Playwright**: three-role smoke, builder-creates-then-admin-confirms-then-route-includes flow, wired into CI with `TEST_DATABASE_URL` from a repo secret (Neon `test` branch) or a `postgres` service container.

## Testing plan
pytest against `TEST_DATABASE_URL` with a per-test transaction rollback; Alembic upgrade in CI; Vitest for RoleSelect and the verified-skill rendering; Playwright with Clerk test users. `uv run mypy .`, ruff, `pnpm -r typecheck`, `pnpm -r lint`.

## Scope-floor variant (if STATE.md says G2 slipped)
Tickets 1, 2, 6, 10 (admin queue) only, with builder profiles rendered read-only from seed data.
