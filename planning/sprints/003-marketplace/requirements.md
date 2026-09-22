# Sprint 003 — Marketplace (Clerk + Convex + graph projection)

**Window:** Sun 27 Sep 08:00 → Mon 28 Sep 20:00 EAT. **Branch:** `sprint/003-marketplace`. **Depends on:** Sprint 002 merged; Clerk keys and Convex deployment (Q-03, Q-04). **Scope-floor variant (if G2 slipped):** read-only builder profiles from seed data + admin queue only.

## Goal
Founders and builders sign in with Clerk; builders maintain profiles and showcase projects in Convex; admins confirm accounts, credentials and projects; confirmed records are projected into the MeTTa graph so routes can include user-entered builders.

## User stories
PRD §3.2 first two, §3.3 first four, §3.4 all three.

## In scope
1. `convex/`: `schema.ts` tables `users` (clerkId, role, confirmed), `profiles`, `skills` (seeded from engine skill list), `credentials`, `projects`, `projectSkills`, `availability`, `confirmations`; `auth.config.ts` for Clerk; functions: `users.upsertFromClerk`, `profiles.get/update`, `projects.create/update/list`, `credentials.create/list`, `admin.listPending`, `admin.confirm`, `admin.reject`; role checks in every mutation via `ctx.auth.getUserIdentity()` claims (`role` from Clerk `publicMetadata` through the JWT template).
2. Clerk in `apps/web`: `<ClerkProvider>` + `<ConvexProviderWithClerk>`, sign-up with role selection cards writing `publicMetadata.role` via a Convex action calling the Clerk Backend API; role-gated routes.
3. Screens 2, 8, 9, 12, 14 from the Stitch pack.
4. Projection (D-15): engine `POST /internal/reproject` (header `X-Internal-Secret`), fetches confirmed records through the Convex Python client (`convex==0.8.*`, `CONVEX_URL`, `CONVEX_DEPLOY_KEY` for server-side read), rebuilds the space from seed + Convex atoms; Convex `admin.confirm` schedules an action that calls it. Engine start-up projects once.
5. Every Convex record gets `demoData: true`.
6. `ADMIN_EMAILS` env in Convex: on `upsertFromClerk`, matching emails get role `admin` and `confirmed: true`.

## Out of scope
Requests, bids, bookings (Sprint 004). Contact-detail sharing beyond three toggles.

## Business rules
DOMAIN.md §Marketplace rules. A skill on a profile is `verified` only if a confirmed credential proves it or a confirmed project demonstrates it; UI derives this from the same data the engine projects.

## Edge cases
Unconfirmed builder signs in → profile editable, banner "Pending BASIX confirmation", absent from routes. Admin rejects a project → removed from graph on next reprojection. Reprojection endpoint unreachable → Convex action retries 3× then writes a `projectionFailed` flag shown in the admin queue.
