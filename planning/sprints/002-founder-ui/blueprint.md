# Sprint 002 — blueprint

## Files
```
services/engine/app/main.py                     # + CORSMiddleware from settings.cors_origins (D-30)
services/engine/app/config.py                   # + cors_origins: list[str]; placeholder key → None
services/engine/scripts/export_offline_snapshot.py   # D-34, --check
services/engine/tests/test_cors.py, test_offline_snapshot.py
.env.example, docker-compose.yml                # + CORS_ORIGINS; compose gains the `web` service (vite preview, port 4173)
.github/workflows/ci.yml                        # D-33: engine + web jobs, Playwright report artifact

apps/web/package.json                           # name "web"; scripts dev, build, preview, typecheck, lint, test, e2e
apps/web/vite.config.ts                         # react, tailwind, vite-plugin-pwa, dev proxy /api,/health → VITE_API_URL
apps/web/index.html, public/icons/{192,512,maskable-512}.png
apps/web/src/main.tsx, App.tsx, router.tsx      # routes: / (landing), /route (intake→review→result), /handoff
apps/web/src/styles/tokens.css                  # DESIGN.md colour/typography tokens as CSS variables
apps/web/src/components/ui/*                    # shadcn CLI output, untouched
apps/web/src/api/client.ts                      # fetch wrapper: getScenarios, postRoute, postConversation; Zod-parses every response
apps/web/src/api/offline.ts                     # VITE_OFFLINE_DEMO=1 source reading src/offline/snapshot.json
apps/web/src/offline/snapshot.json              # generated (D-34), never hand-edited
apps/web/src/state/routing.ts                   # currentBrief, turns, lastResponse; useReducer + context, no extra state lib
apps/web/src/features/landing/*                 # screen 1
apps/web/src/features/intake/*                  # screen 3: chat, scenario chips, "Use the form instead" BriefForm
apps/web/src/features/review/*                  # screen 4: BriefChips, inline field errors
apps/web/src/features/route/*                   # screen 5: StatusBadge, CostStrip, GapsPanel, BuilderCard, IpCard, CohortCard, PartnerCard, EmptyTeam
apps/web/src/features/why/*                     # screen 6: WhyDrawer (Founder | Technical tabs), PathFacts
apps/web/src/features/handoff/handoffText.ts, HandoffScreen.tsx   # screen 7
apps/web/src/lib/format.ts                      # usd(n) → "USD n / day", dateRange(a,b) → "22 Sep – 29 Sep 2026", evidenceLabel
apps/web/src/components/DemoDataPill.tsx
apps/web/test/*.test.tsx                        # Vitest + RTL (jsdom)
apps/web/e2e/*.spec.ts, playwright.config.ts    # webServer: engine (LLM_PROVIDER=null) + vite preview
```

## Inherited from Sprint 001 (read before slicing)
- **Contracts**: `@venture-route/contracts` exports `VentureBrief`, `PartialBrief`, `VentureRoute`, `ChatResponse`, `Gap`, `ReasoningPath` and the enums. Run `pnpm -F @venture-route/contracts build` before the web typecheck (turbo `^build` already does this). The API wire format is camelCase.
- **Endpoints and shapes**: see `planning/STATE.md` §What Sprint 002 inherits and `docs/API.md`. `reusableIp`, `cohort` and `partner` arrive as `null` when absent.
- **Exact screen values** come from the engine as merged (Architect re-run on 2026-09-22):
  - Health pilot: 370 against 400.
  - Partner path: 4 facts, in the order in acceptance.md.
  - Health at 250: one `assembler.budget-fit` gap, action `Raise daily budget to USD 370`.
  - Constrained: one `skill` gap on `mobile` with two actions, "Ask BASIX to confirm a credential or project for mobile." and "Remove mobile from the brief or replace it with a related skill." (D-29).
- **CORS**: the Sprint 001 engine answers a CORS preflight with **405**. The first ticket fixes this (D-30).
- `route.summary` may be LLM text. It may appear in the chat bubble, never in the handoff (AGENTS.md rule 3).
- `VentureRoute` has no `demoData` field. In Sprint 002 every route entity comes from the seed graph, so every builder, IP, cohort and partner card shows the Demo data pill unconditionally, as does the brief when `brief.demoData` is true. Sprint 003 adds per-row flags.

## Steps
1. **Engine prerequisites ticket** (TDD at the HTTP seam):
   - CORS pytest (allowed origin, disallowed origin).
   - Snapshot script and its equality test.
   - Placeholder-key test: `ANTHROPIC_API_KEY=sk-ant-replace-me` → `NullAdapter`.
   - `.env.example` + compose `CORS_ORIGINS`.
2. **Scaffold ticket**: `pnpm create vite apps/web --template react-ts`, React 19, then the `shadcn` CLI init (Tailwind v4, CSS variables) and component adds. Also: DESIGN.md tokens in `tokens.css`, `@fontsource` fonts, the contracts workspace dependency, eslint, Vitest (jsdom) and Playwright config, and the CI workflow with the `engine` job and a `web` job running typecheck/lint/test. CI must be green here before any screen ticket.
3. **API client + routing state**: every response is parsed with the contract Zod schema. A parse failure shows the API-unreachable banner, never a crash. The offline source implements the same interface.
4. **Intake (screen 3)**: chat turns to `POST /api/conversation`, scenario chips, and the BriefForm with the Calendar range picker to `POST /api/route`.
5. **Review (screen 4)**: editable chips, Zod re-validation, a server `validation-error` mapped to a field by the message prefix, Find my route.
6. **Route result (screen 5)**: StatusBadge, CostStrip, GapsPanel (rendered before the team section in the JSX tree, not reordered with CSS), cards, EmptyTeam. The next-action buttons for `budget` and `team-size` parse the integer from the D-22 text and patch the brief. Other actions are shown as disabled "suggestion" buttons with the text as label (no side effect in Sprint 002).
7. **Why drawer (screen 6)**: shadcn Sheet with Founder/Technical tabs over the `ReasoningPath`s (D-31).
8. **Handoff (screen 7)**: the pure `handoffText`, then copy (Clipboard API) and download (Blob).
9. **PWA + offline**: vite-plugin-pwa `registerType: 'autoUpdate'`, the manifest per D-32, the snapshot source behind `VITE_OFFLINE_DEMO`.
10. **Landing (screen 1)**: six sections from the Stitch export. CTA "Find a route" → `/route`.
11. **Playwright suite + CI `web` e2e step**: `playwright.config.ts` `webServer` starts the engine (`uv run uvicorn app.main:app --port 8000` with `LLM_PROVIDER=null`, `CORS_ORIGINS=http://localhost:4173`) and `pnpm -F web preview --port 4173` with `VITE_API_URL=http://localhost:8000`.

## Interfaces consumed by Sprint 003
`apps/web` route tree (Clerk wraps it in Sprint 003), the `api/client.ts` fetch wrapper (Sprint 003 adds the bearer token), `DemoDataPill`, `format.ts`, and the CI workflow (Sprint 003 adds a Postgres service container).

## Testing plan
- Engine: `uv run pytest -q`, ruff, `mypy .`, `export_schema.py --check`, `export_offline_snapshot.py --check`.
- Web: `pnpm -r typecheck lint test`, and `pnpm -F web e2e` (Playwright, Chromium).
- CI runs both jobs on every PR push.
