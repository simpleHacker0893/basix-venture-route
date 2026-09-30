# TIMELINE — Tue 22 Sep → Thu 1 Oct 2026 (Africa/Nairobi, EAT)

Demo: **Thursday 1 October 2026**. Nine calendar days. Sprints are gated by **timeline and acceptance**: a sprint starts at its slot only if the previous sprint's PR is merged; if a gate is missed, the fallback in the last column applies and the next sprint still starts on time.

| Sprint | Window (EAT) | Gate | Gate check | If the gate is missed |
|---|---|---|---|---|
| Pack approval | Tue 22 Sep, by 18:00 | G-pack | Operator replies "approve" and installs the GitHub App | Builder 000 starts locally from the handoff prompt anyway |
| 000 MeTTa spike | Tue 22 Sep 18:00 → Wed 23 Sep 12:00 (half-day Builder box) | G0 Wed 23 Sep 12:00 | `pytest -m runtime` green through FastAPI; PR merged | Escalate to MeTTa mentor; shrink rules to `verified-for-skill` + `eligible-builder`; never a matcher (D-11) |
| 001 Routing core | Wed 23 Sep 12:00 → Thu 24 Sep 20:00 | G1 Thu 24 Sep 20:00 | All five scenarios pass in pytest; form path = chat path; PR merged | Drop LLM extractor to form-only for 002; keep explanation adapter |
| Stitch batch 1 (Operator, parallel) | Wed 23 Sep → Thu 24 Sep 18:00 | — | 5 exports under `design/stitch/batch-1/` | Builder uses shadcn defaults + DESIGN.md tokens |
| 002 Founder UI | Fri 25 Sep 08:00 → Sat 26 Sep 20:00 | G2 Sat 26 Sep 20:00 | Playwright: preloaded brief → route, gaps, drawer, handoff; PR merged | **Scope floor trigger:** 003+004 collapse to read-only profiles + gated bids; 005 starts Mon 28 Sep |
| Stitch batches 2–4 (Operator, parallel) | Fri 25 Sep → Sat 26 Sep | — | exports under `design/stitch/batch-{2,3,4}/` | Builder uses shadcn defaults |
| Stitch batch 6 Showcase (Operator, Q-17) | Thu 24 Sep → Fri 25 Sep 18:00 | — | `design/stitch/batch-6/showcase-gallery` and `showcase-detail` | Builder composes from batch-4 requests-board and batch-3 candidate-profile / add-project |
| 003 Marketplace | Sun 27 Sep 08:00 → Mon 28 Sep 20:00 | G3 Mon 28 Sep 20:00 | Clerk sign-in per role; admin confirmation gates visibility; Postgres → graph reprojection test (D-17); PR merged | Ship profiles + admin queue only; defer projects UI |
| 004 Requests & interviews | Tue 29 Sep 08:00 → Tue 29 Sep 22:00 | G4 Tue 29 Sep 22:00 | Gated bid test; booking round-trip test; PR merged | Ship requests board + gated bids; defer booking |
| 004 close-out | Thu 24 Sep | G4 | Clerk session-token claim set; `e2e:clerk` green on #76; #77 CI with secrets; PR #78 merged | Operator override merge as for 003, with the lines recorded in STATE.md |
| 005a Showcase and Chloe (D-42, D-51) | Fri 25 Sep 08:00 → Sun 27 Sep 20:00 (spec #86) | G5a Sun 27 Sep 20:00 | Showcase visibility table, scenario route-equality invariant (D-52), résumé suggest endpoint; Chloe RTL and `chloe.spec.ts` (voice path route deep-equals the form path); conversation contract unchanged (narrowed diff, D-51); Clerk showcase spec; PR "Sprint 005a: Showcase and Chloe" merged | Showcase scope floor (blueprint); Chloe merges switched off (`VITE_VOICE_PROVIDER=off`) without holding the Showcase; last resort hide the Showcase behind `VITE_SHOWCASE=0`; Part B starts on time |
| 005 Demo hardening | Mon 28 Sep 08:00 → Wed 30 Sep 20:00 | G5 (freeze) Wed 30 Sep 22:00 | `docker compose up` clean run of all five scenarios + Showcase + a Chloe moment on the fake provider; README; `docs/DEPLOY.md` wizard handed to the Operator, who runs Railway + Vercel (D-27); Playwright demo video saved; pitch deck + `docs/PITCH.md` (D-28) | Demo from laptop only; recording still mandatory |
| Rehearsal | Wed 30 Sep 20:00 → 22:00 | — | Operator runs the demo script twice from a clean launch | — |
| **Demo** | **Thu 1 Oct** | — | — | Play the recording if live fails |
| 006 Chloe voice intake | Merged into 005a (D-51) | G5a | See the 005a row | No separate post-demo sprint; any Chloe line that misses G5a is listed in `STATE.md` for after the demo |

## Daily rhythm
- 08:00 Builder session starts (Routine or Operator-launched). Reads `STATE.md`, the sprint folder, and yesterday's PR comments.
- 12:00 and 18:00 Builder posts a progress comment on the sprint PR (ticket status, blockers).
- 20:00 Gate check: Architect Builder Review against `acceptance.md`; Operator merges or returns findings.
- 22:00 Architect writes/refreshes the next sprint's `blueprint.md` and `handoff-prompt.md` from the review; updates `STATE.md`.

## Critical path
000 → 001 → 002 is the demo floor and cannot slip. Stitch batch 1 must land before 002 starts. Everything from 003 on is stretch and is protected by the scope-floor trigger at G2.
