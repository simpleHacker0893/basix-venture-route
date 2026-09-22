# Sprint 002 — Founder UI

**Window:** Fri 25 Sep 08:00 → Sat 26 Sep 20:00 EAT. **Branch:** `sprint/002-founder-ui`. **Depends on:** Sprint 001 merged; Stitch batch 1 exports under `design/stitch/batch-1/` (fallback: shadcn defaults with DESIGN.md tokens).

## Goal
The demo floor on screen: intake, brief review, route result with gaps first, Why this route? drawer, venture handoff, landing page, as an installable desktop-first PWA talking only to the Sprint 001 API.

## User stories
PRD §3.1 (all ten) and §3.5 judge story.

## In scope
1. `apps/web` scaffold: Vite + React 18 + TS strict, Tailwind with DESIGN.md tokens as CSS variables, shadcn/ui (button, badge, card, sheet, calendar, popover, form, toggle, tabs, table), vite-plugin-pwa manifest + service worker (app shell + `/api/scenarios` cached), fonts Fraunces / IBM Plex Sans / IBM Plex Mono.
2. Screens 1, 3, 4, 5 (feasible + partial + infeasible), 6, 7 from `docs/design/stitch-prompts.md`, converted from Stitch exports; every seed-derived card carries the Demo data pill.
3. Routing state: `currentBrief`, chat turns, latest `ChatResponse`; "Load scenario" chips call `GET /api/scenarios`; "Use the form instead" renders the full brief form (shadcn Calendar range picker, D-08) posting to `POST /api/route`.
4. Brief review chips editable; edits re-validate with the Zod schema from `packages/contracts` before submit.
5. Why this route? drawer: Founder view (ordered facts, rule name, evidence badge per builder×skill, IP, cohort, partner) and Technical view (raw rule expression and query string returned by the API in `route.debug` when `ENGINE_DEV_QUERY=1`; hidden otherwise).
6. Handoff export: plain-text generated client-side from `VentureRoute` only; copy + download.
7. Offline mode flag (`VITE_OFFLINE_DEMO=1`): loads the five seed routes from a static JSON snapshot for the recorded fallback.

## Out of scope
Auth, marketplace screens, Convex.

## Business rules
Gaps panel above team cards whenever `gaps.length > 0`. Status badge text exactly `Feasible | Partial | Infeasible`. Currency `USD n / day`. Dates `22 Sep – 29 Sep 2026`.

## Edge cases
API unreachable → banner with "Use the form instead" and offline snapshot if flag set. Validation-error response → inline field errors on the review screen. Infeasible route → gaps panel only, empty team state, no IP/partner cards.
