# Sprint 004 — Requests, gated bids, interviews

**Window:** Tue 29 Sep 08:00 → Tue 29 Sep 22:00 EAT. **Branch:** `sprint/004-requests-interviews`. **Depends on:** Sprint 003 merged. **Scope-floor variant:** requests board + gated bids only; no booking.

## Goal
A founder publishes a request from a confirmed brief; eligible builders bid; a founder books an interview inside the platform.

## User stories
PRD §3.2 last two; §3.3 last three.

## In scope
1. Convex tables `requests` (founderId, brief snapshot, status open/closed), `bids` (requestId, builderId, dayRate, message, eligibleSkills, status), `bookings` (requestId?, founderId, builderId, proposedStart, durationMin, state, history[]).
2. Eligibility gate: `bids.create` calls engine `POST /api/eligibility` `{brief, builderId}` → `{eligible, skills[], path}`; reject the mutation when not eligible; the requests board shows the indicator text from that response.
3. Screens 10, 11, 13 from the Stitch pack.
4. Booking state machine `proposed → accepted | countered → confirmed`, one counter per round per side; times in Africa/Nairobi.
5. Founder dashboard tiles fed by Convex queries.

## Out of scope
Notifications beyond in-app state; payments; video links (placeholder text).

## Edge cases
Builder becomes unconfirmed after bidding → bid hidden from founder. Request closed → bids disabled. Counter-proposal on a confirmed booking → rejected.
