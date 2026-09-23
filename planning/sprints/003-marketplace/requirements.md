# Sprint 003 — Marketplace (Clerk + Neon Postgres + graph projection)

**Window:** Sun 27 Sep 08:00 → Mon 28 Sep 20:00 EAT. **Branch:** `sprint/003-marketplace`. **Depends on:** Sprint 002 merged; Clerk keys and a Neon `DATABASE_URL` (Q-03, Q-04). **Scope-floor variant (if G2 slipped):** read-only builder profiles from seed data + admin queue only.

## Goal
Founders and builders sign in with Clerk; builders maintain profiles and showcase projects in Postgres through the FastAPI marketplace API; admins confirm accounts, credentials and projects; confirmed rows are projected into the MeTTa graph so routes can include user-entered builders.

## User stories
PRD §3.2 first two, §3.3 first four, §3.4 all three.

## In scope
1. `services/engine/app/marketplace/`: SQLModel tables `users` (clerk_id, email, role, confirmed, demo_data=true), `profiles`, `skills` (seeded from the engine skill list), `credentials`, `projects`, `project_skills`, `availability`, `confirmations`; Alembic migration 0001; `asyncpg` engine from `DATABASE_URL`; compose `db` service (postgres:18) for local dev; Neon branch for CI.
2. Auth: FastAPI dependency `current_user` verifies the Clerk session JWT (JWKS from `CLERK_JWKS_URL`), reads `role` from `publicMetadata`; `require_role(...)` dependency on every marketplace route. `POST /api/webhooks/clerk` (Svix signature) upserts `users` on `user.created` / `user.updated`; emails in `ADMIN_EMAILS` become `admin` + `confirmed`.
3. Endpoints: `GET/PUT /api/me/profile`, `POST/GET /api/me/projects`, `POST/GET /api/me/credentials`, `GET /api/builders/{id}` (founder view, contact fields filtered by sharing toggles), `GET /api/admin/pending`, `POST /api/admin/confirm/{kind}/{id}`, `POST /api/admin/reject/{kind}/{id}`.
4. Clerk in `apps/web`: `<ClerkProvider>`, sign-up with role selection cards writing `publicMetadata.role` through `POST /api/me/role` (backend Clerk API call, once, at first sign-in); role-gated routes; screens 2, 8, 9, 12, 14 from the Stitch pack.
5. Projection (D-15, D-17): `reproject()` rebuilds the space from seed facts plus confirmed rows; called in-process after every confirm/reject commit and once at start-up. `GET /health` reports `facts_loaded` and `projected_rows`.
6. Every row carries `demo_data = true` (column default + check constraint).

## Out of scope
Requests, bids, bookings (Sprint 004). Contact-detail sharing beyond three toggles.

## Business rules
DOMAIN.md §Marketplace rules. A skill on a profile is `verified` only if a confirmed credential proves it or a confirmed project demonstrates it; the API computes this from the same rows the engine projects.

## Edge cases
Unconfirmed builder signs in → profile editable, banner "Pending BASIX confirmation", absent from routes. Admin rejects a project → removed from graph on the next reprojection. Webhook replay → idempotent upsert. Expired or wrong-issuer JWT → 401, never a 500.
