# Sprint 004 — blueprint (finalised 2026-09-23 after the Sprint 003 review)

## Inherited (read `planning/sprints/003-marketplace/review.md` §What Sprint 004 inherits first)
Auth dependencies, session, marketplace models and repo, projection, conftest with `migrated_database`, web auth provider and role-gated routes all exist. Reuse them; do not redefine. Money is USD per day (D-16). Times are Africa/Nairobi, stored as UTC timestamps with the zone applied in the presenter.

## Files
```
services/engine/alembic/versions/0002_requests_bids_bookings.py
services/engine/app/marketplace/models.py              # + Request, Bid, Booking (all demo_data default true + CHECK)
services/engine/app/marketplace/repo.py                # + request/bid/booking queries, dashboard counts
services/engine/app/marketplace/schemas.py             # + RequestCreate/Out, BidCreate/Out, BookingCreate/Out, Eligibility, Dashboard
services/engine/app/marketplace/booking.py             # pure state machine: transition(state, action, actor, history) -> (state, history) | IllegalTransition
services/engine/app/routing/eligibility.py             # eligibility(engine, brief, builder_id) -> {eligible, skills[], path, reason}; uses eligible_builders + gaps only
services/engine/app/api/requests.py                    # POST/GET /api/requests, POST /api/requests/{id}/close, GET /api/requests/{id}/eligibility, POST /api/requests/{id}/bids
services/engine/app/api/bids.py                        # GET /api/me/bids (builder), GET /api/requests/{id}/bids (founder owner)
services/engine/app/api/bookings.py                    # POST /api/bookings, POST /api/bookings/{id}/{accept|counter|confirm}, GET /api/me/bookings
services/engine/app/api/dashboard.py                   # GET /api/me/dashboard (founder tiles)
services/engine/tests/test_requests.py, test_bids_gate.py, test_booking_machine.py, test_bookings_api.py, test_dashboard.py
packages/contracts/src/marketplace.ts                  # Zod for Request, Bid, Booking, Eligibility, Dashboard (mirrors + parity test)
apps/web/src/features/requests/*                       # screen 10: board, filter chips, eligibility indicator, BidDialog
apps/web/src/features/dashboard/*                      # screen 11: tiles, briefs/routes table, bids received, upcoming interviews
apps/web/src/features/booking/*                        # screen 13: single-month Calendar, slots, duration, summary, state steps, counter variant
apps/web/src/router.tsx                                # + /requests (builder), /dashboard (founder), /bookings/:id (founder|builder), /route → "Publish as request" (founder)
apps/web/e2e/requests.spec.ts                          # request → bid → booking round-trip with Clerk test users
```

## Steps (tickets in this order)
1. **Migration 0002 + models + contracts**: three tables, `demo_data` checks, Zod mirrors, parity test green.
2. **Eligibility function** on the route service: `eligibility(engine, brief, builder_id)` returning `{eligible, skills[], path}` from `eligible_builders` and the reason from `gaps` (never a new matcher). Table-driven test with the seed: `naomi-chebet` after confirmation, an unconfirmed builder, a builder verified but unavailable.
3. **Requests API**: founder publishes a request from a `VentureBrief` snapshot; list open requests (builder sees all open; founder sees own); close → 409 on later bids.
4. **Bids API with the gate**: 403 with the engine's reason when not eligible; stored bid carries `eligible_skills` and the path; `GET /api/me/bids`; bids from builders who become unconfirmed are hidden from the founder list.
5. **Booking state machine** as a pure function (proposed → accepted | countered → confirmed; one counter per round per side; 409 on illegal transitions; history appended atomically), then the API over it.
6. **Dashboard API**: counts for briefs (requests), routes, open requests, bids received, bookings; all from SQL.
7. **Web: requests board + BidDialog** (screen 10) with the indicator text from `GET .../eligibility`.
8. **Web: founder dashboard** (screen 11) + "Publish as request" on the route result.
9. **Web: booking screen** (screen 13) with accept/counter variants.
10. **Playwright**: founder publishes → builder bids → founder proposes → builder counters → founder accepts → `confirmed`, history has three entries; wired into CI with the Postgres service container.

## Testing plan
pytest at the HTTP seam against `TEST_DATABASE_URL` with fake JWTs per role; the state machine as a pure-function table test; Vitest for the indicator and the booking step rendering; Playwright round-trip. `uv run mypy .`, ruff, `pnpm -r typecheck`, `pnpm -r lint`.

## Scope-floor variant
Tickets 1–4, 7 only (requests board + gated bids); no bookings, no dashboard.
