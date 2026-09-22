# Sprint 002 — Founder UI

**Window:** Fri 25 Sep 08:00 → Sat 26 Sep 20:00 EAT. **Branch:** `sprint/002-founder-ui`. **Depends on:** Sprint 001 merged (PR #20). Stitch batch 1 exports should be under `design/stitch/batch-1/`; if they are missing, use shadcn defaults with the DESIGN.md tokens and say so in the report.

## Goal
Put the demo floor on screen: intake, brief review, route result with gaps first, the Why this route? drawer, venture handoff and landing page. It ships as an installable, desktop-first PWA that talks only to the Sprint 001 API. CI proves it on every PR.

## User stories
PRD §3.1 (all ten) and §3.5 judge story.

## In scope
0. **Engine prerequisites** (small, first ticket, in `services/engine`):
   - Add `CORSMiddleware` with the allow-list from `CORS_ORIGINS` (D-30), and add `CORS_ORIGINS` to `.env.example` and compose.
   - Add `scripts/export_offline_snapshot.py` with `--check` (D-34).
   - Treat an `ANTHROPIC_API_KEY` equal to the `.env.example` placeholder (`sk-ant-replace-me`) as unset, so a verbatim copy of `.env.example` selects `NullAdapter`.
1. `apps/web` scaffold:
   - Vite + React 19 + TS strict (D-25), eslint, Tailwind with the DESIGN.md tokens as CSS variables.
   - shadcn/ui through the `shadcn` CLI: button, badge, card, sheet, calendar, popover, form, toggle, tabs, table, sonner.
   - vite-plugin-pwa manifest and service worker (app shell precached; `/api/scenarios` stale-while-revalidate).
   - Fonts Fraunces, IBM Plex Sans and IBM Plex Mono, self-hosted through `@fontsource`.
   - Imports types and Zod schemas from `@venture-route/contracts` (workspace dependency). The web app never redefines a contract type.
2. Screens 1, 3, 4, 5 (feasible, partial and infeasible states), 6 and 7 from `docs/design/stitch-prompts.md`, converted from the Stitch exports. Every seed-derived card carries the Demo data pill.
3. Routing state:
   - One store holding `currentBrief`, chat turns and the latest `ChatResponse`.
   - "Load scenario" chips call `GET /api/scenarios`.
   - "Use the form instead" renders the full brief form (shadcn Calendar range picker, D-08), which posts to `POST /api/route`.
4. Brief review chips are editable. An edit re-validates with the `VentureBrief` Zod schema before submit and re-posts to `POST /api/route`.
5. Why this route? drawer (D-31) with two views:
   - **Founder view**: for each builder, one row per skill with its evidence badge and the ordered facts of each `evidencePaths` entry; then IP, cohort and partner, each with its path's rule name and ordered facts.
   - **Technical view** (toggle): the same `ReasoningPath`s rendered as `rule`, the monospace `facts` and the `conclusion`.
6. Handoff export:
   - Plain text generated client-side by a pure function `handoffText(brief, route)` from `VentureBrief` + `VentureRoute`.
   - Never includes `route.summary` or any other LLM text.
   - Copy and download (`venture-route-<brief.id>.txt`).
7. Offline mode (`VITE_OFFLINE_DEMO=1`): loads briefs and routes from `src/offline/snapshot.json` (D-34), with no network. The banner reads "Offline demonstration mode".
8. CI (D-33): `.github/workflows/ci.yml` with the `engine` and `web` jobs.

## Out of scope
- Auth, Clerk, marketplace screens (2, 8–14) and Postgres.
- Any change to the MeTTa rules, the route contract or the scenario outcomes.

## Business rules
- The Gaps panel sits above the team cards in DOM order whenever `gaps.length > 0` (AGENTS.md rule 6).
- Status badge text is exactly `Feasible`, `Partial` or `Infeasible`.
- Currency: `USD n / day`. Cost strip: `USD <totalDailyRate> / day` against `USD <dailyBudget> / day`.
- Dates: `22 Sep – 29 Sep 2026` (en dash, Africa/Nairobi, date-only).
- Each gap renders `statement`, its `rule` name, and one button per `nextActions` entry in order (D-29). A budget or team-size gap button pre-fills the review chip with the new value.
- Evidence badge labels: `Credential`, `Project`, `Both` for `credential`, `project` and `both` (D-35: the Stitch DESIGN.md block wins).
- The browser never parses MeTTa. It renders `VentureRoute` fields only.

## Edge cases
- API unreachable: show a banner with "Use the form instead", plus the offline snapshot if the flag is set. Never a blank screen.
- `validation-error` response: inline error on the matching review field. The message prefix before `:` names the field (`dailyBudget: …`). A message without a prefix shows at the top of the form.
- Infeasible route: gaps panel, the empty team state "No verified builder fits this brief yet", and no IP, cohort or partner cards.
- Budget-gap route (`builders: []`, one `assembler.budget-fit` gap): same layout as infeasible, but the badge reads `Partial`.
