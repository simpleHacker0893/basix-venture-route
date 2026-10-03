# Sprint 007: Hourly pricing (D-59)

Brainstormed and approved with the Operator on 2026-10-02. Sprint 008 (admin review) and Sprint 009 (admin communication) build on this one; they show hourly figures from their first screen.

## Goal

Every price in Venture Route is per hour. A builder charges a whole number of US dollars per hour from 0 to 50; a founder's brief carries a budget per hour for the whole team. The route's budget check, the MeTTa graph, the stored data, every screen and every doc use the hourly figure. No day rate remains outside history.

## Rules (D-59)

| Rule | Value |
|---|---|
| Builder rate | `hourlyRate`: integer USD per hour, 0 to 50 inclusive; 0 means free or volunteer |
| Founder budget | `hourlyBudget`: integer USD per hour for the whole team, 1 to 250 inclusive (50 × the largest team of 5, `TeamSize` in `packages/contracts/src/brief.ts`) |
| Budget fit | A team fits when the sum of its members' `hourlyRate` is at most `hourlyBudget` (same shape as today's daily rule, D-16) |
| Conversion of existing figures | day figure ÷ 8, rounded half up (`ROUND_HALF_UP`, so 12.5 → 13), builder rates capped at 50 |
| Out of range | 422 from both Zod and Pydantic, naming the field |

The budget check stays in the deterministic assembler (`services/engine/app/routing/assembler.py`). No new MeTTa rule; the seven named rules are unchanged (AGENTS.md, D-16).

## Engine and MeTTa

- **Fact rename.** `(day-rate <builder> <usd>)` becomes `(hourly-rate <builder> <usd>)` in `services/engine/seed/facts.metta` (14 seed builders) and in `reproject()`'s rendering of confirmed marketplace builders. The fact count stays 181; `/health` still reports `facts_loaded: 181`, `rules_loaded: 7`.
- **Seed values** (÷ 8, half up): amina-otieno 15, daniel-kiptoo 19, grace-wambui 13, wanjiru-mwangi 18, brian-odhiambo 15, fatuma-hassan 10, zawadi-njoroge 16, juma-kariuki 11, peter-omondi 14, samuel-kimani 13, lucy-achieng 12, kevin-mutua 9, mercy-akinyi 11, hassan-abdi 8.
- **Brief model.** `daily_budget` / `dailyBudget` becomes `hourly_budget` / `hourlyBudget` in `app/models/brief.py`, `app/models/chat.py` and the conversation orchestrator's missing-field list. The Zod types `DailyBudget` and `UsdPerDay` become `HourlyBudget` and `UsdPerHour`.
- **Route model.** The route's `totalDailyRate` becomes `totalHourlyRate` (`packages/contracts/src/route.ts`, its Pydantic twin, the cost strip, the handoff text "TOTAL HOURLY RATE", the founder dashboard and the request snapshot). The request's own `dailyBudget` (`packages/contracts/src/marketplace.ts`) becomes `hourlyBudget`.
- **Assembler and next actions.** `assembler.py` compares against `brief.hourly_budget`. `next_actions.py`: `raise_daily_budget` becomes `raise_hourly_budget` → `"Raise the hourly budget to USD {total}"`; `budget_statement` → `"Cheapest verified team costs USD {total} an hour; budget is USD {budget} an hour"`. The reason code `assembler.budget-fit` and gap category `budget` keep their names.
- **LLM adapters.** The intake prompt and strict extraction schema (Anthropic and OpenRouter adapters, `app/llm/`) ask for the budget per hour. The explain prompt receives hourly figures. The null adapter is unchanged in behaviour.
- **Generated artefacts.** `packages/contracts/src/schema.json` and the offline demo snapshot are regenerated; both `--check` scripts pass.

## Demo scenarios

`services/engine/seed/briefs.json` budgets become: health 50, agri 44, constrained 38, budget-challenge 31, onsite 50. Expected outcomes, re-pinned by the existing scenario tests:

| Brief | Outcome after the change |
|---|---|
| `brief-health-01` | `feasible`: Amina (15) + Daniel (19) + Grace (13) = USD 47 an hour within 50; `asset-afya-triage`; partner `amani-health` via four hops |
| `brief-agri-01` | `feasible`: Wanjiru (18) + Lucy (12) + Fatuma (10) = USD 40 an hour within 44 (Lucy still beats Brian, 15, on cost); `asset-shamba-records`; partner `shamba-agri` |
| `brief-constrained-01` | `partial`: Rust builder eligible, `skill` gap for mobile |
| `brief-budget-01` | `partial`: no team, one `budget` gap, "Raise the hourly budget to USD 47" |
| `brief-onsite-01` | `infeasible`: three `location` gaps, no builders, IP or partner |

If rounding changes which team the assembler picks for a scenario, the status, the gap categories and the reusable IP and partner must still match this table; the pinned team members and total are updated to what the engine returns, and the change is noted in the PR.

## Data: migration `0004_hourly_pricing`

- `profiles.day_rate` is renamed `hourly_rate`; existing values become `min(50, round_half_up(day_rate / 8))`; a check constraint holds `0 <= hourly_rate <= 50`.
- In `requests`, the stored budget and route snapshot (D-47) are converted the same way: `dailyBudget` → `hourlyBudget` (clamped to 1–250) and `totalDailyRate` → `totalHourlyRate` (÷ 8, half up).
- `bids.day_rate` (the rate a builder offers on a bid, wire `dayRate`) becomes `hourly_rate` / `hourlyRate` with the same conversion and the same 0–50 check as profiles; the bid dialog pre-fills it from the profile's hourly rate.
- The migration logs how many builder rates it capped at 50 and how many request snapshots it converted.
- Downgrade reverses the rename and multiplies by 8 (lossy, acceptable for demo data). A free rate (0) comes back as 1, because migration `0003`'s checks require a day rate above 0.
- Sprint 008's admin-reasons migration becomes `0005`.

## Screens

Every place that shows or edits money switches to per-hour wording, with the unit always visible:

- Builder profile form (`apps/web/src/features/builder/ProfileForm.tsx`): field "Hourly rate (USD, 0–50)", integer input.
- Brief chips, chat read-back and brief review: "Budget per hour (USD)".
- Route result cost strip and builder cards: "USD 47 an hour".
- Requests list and detail, founder dashboard, builder home, candidate view (`/builders/:id`), offline mode screens.
- Chloe's spoken phrases (`apps/web/src/chloe/`): "an hour" wherever "a day" is said.

## Docs

README (worked example, demo scenarios, quick links stay), `planning/DOMAIN.md`, `docs/API.md`, `docs/PRD.md`, `CONTEXT.md` glossary, `docs/demo/SCRIPT.md`, `SUBMISSION.md` description ("daily cost" → "hourly cost"; still passes `check_submission.py --final`), `planning/DECISIONS.md` (D-59, amending D-16). Old sprint folders, migrations `0001`–`0003` and past decisions stay as written.

## Tests (seams per D-19)

- Engine: scenario route tests re-pinned to the table above; assembler budget-fit at the boundary (sum = budget fits, budget + 1 does not); `hourlyRate` 0 and 50 accepted, −1 and 51 rejected over HTTP; migration test on a seeded `0003` database (rename, conversion, cap, snapshot conversion); `test_deploy_config.py` unchanged in shape.
- Contracts: Zod bounds for `hourlyRate` and `hourlyBudget`; the Zod ↔ Pydantic parity test covers the renamed fields.
- Web: RTL for the profile form label and bounds, the cost strip and the brief chip wording.
- Playwright: the Clerk and no-key specs fill "Hourly rate" and read "an hour".

## Acceptance

1. `git grep -niE "day-rate|dayRate|day_rate|dailyBudget|daily_budget|DailyRate|daily_rate|UsdPerDay|raise_daily_budget|TOTAL DAY RATE" -- ':!planning/sprints/00[0-6]*' ':!services/engine/alembic/versions/000[1-3]*' ':!planning/DECISIONS.md' ':!graphify-out' ':!design' ':!docs/design/stitch-prompts.md'` prints nothing outside migration `0004`, the deliberate negative tests and this spec. `design/` and `docs/design/stitch-prompts.md` are approved design snapshots (D-36) and stay as history.
2. CI on the PR is green: engine, web (Vitest, no-key Playwright, Clerk Playwright), D-51 check.
3. `uv run python scripts/export_schema.py --check` and `scripts/export_offline_snapshot.py --check` pass.
4. After merge and deploy: `curl https://venture-route-engine.onrender.com/health` shows `facts_loaded 181`, `rules_loaded 7`; on <https://basix-venture-route.vercel.app/route> the Health pilot routes `feasible` at USD 47 an hour, and the Budget challenge shows "Raise the hourly budget to USD 47".

## Out of scope

Currency other than USD; per-builder hours or project totals; a MeTTa budget rule; a compatibility layer for old clients during the deploy (Vercel and Render deploy within about a minute; a stale page can see one 422 on route).
