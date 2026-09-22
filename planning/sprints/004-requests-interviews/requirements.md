# Sprint 004 — Requests, gated bids, interviews

**Window:** Tue 29 Sep 08:00 → Tue 29 Sep 22:00 EAT. **Branch:** `sprint/004-requests-interviews`. **Depends on:** Sprint 003 merged. **Scope-floor variant:** requests board + gated bids only; no booking.

## Goal
A founder publishes a request from a confirmed brief; eligible builders bid; a founder books an interview inside the platform.

## User stories
PRD §3.2 last two; §3.3 last three.

## In scope
1. SQLModel tables + Alembic migration 0002: `requests` (founder_id, brief JSON snapshot, status open/closed), `bids` (request_id, builder_id, day_rate, message, eligible_skills JSON, status), `bookings` (request_id nullable, founder_id, builder_id, proposed_start, duration_min, state, history JSON). Endpoints `POST/GET /api/requests`, `POST /api/requests/{id}/close`, `GET /api/requests/{id}/eligibility` (current builder), `POST /api/requests/{id}/bids`, `GET /api/me/bids`, `POST /api/bookings`, `POST /api/bookings/{id}/{accept|counter|confirm}`, `GET /api/me/dashboard`.
2. Eligibility gate: `POST /api/requests/{id}/bids` calls the route service's `eligibility(brief, builder_id)` in-process → `{eligible, skills[], path}`; returns 403 with the reason when not eligible; the requests board shows the indicator text from `GET .../eligibility`.
3. Screens 10, 11, 13 from the Stitch pack.
4. Booking state machine `proposed → accepted | countered → confirmed`, one counter per round per side; times in Africa/Nairobi.
5. Founder dashboard tiles fed by `GET /api/me/dashboard`.

## Out of scope
Notifications beyond in-app state; payments; video links (placeholder text).

## Edge cases
Builder becomes unconfirmed after bidding → bid hidden from founder. Request closed → bids return 409. Counter-proposal on a confirmed booking → 409. All state changes in one transaction; history appended in the same commit.
