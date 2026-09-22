# Sprint 002 — acceptance

Every Playwright line runs against `vite preview` (production build) with the engine started using `LLM_PROVIDER=null`, both locally and in CI (D-33).

## Must
- [ ] Engine: a preflight `OPTIONS /api/route` with `Origin: http://localhost:5173` returns 200 with `access-control-allow-origin: http://localhost:5173`. An origin not in `CORS_ORIGINS` gets no allow-origin header (pytest, D-30).
- [ ] Engine: `uv run python scripts/export_offline_snapshot.py --check` reports up to date, and the snapshot's five routes equal `POST /api/route` for the five seed briefs (pytest, D-34).
- [ ] Playwright, Health pilot: load the scenario → review → Find my route. The route screen shows:
  - the `Feasible` badge;
  - exactly 3 builder cards (Amina Otieno, Daniel Kiptoo, Grace Wambui) with evidence badges `Both`, `Both`, `Credential` (D-35), each with a Demo data pill;
  - the cost strip `USD 370 / day` against `USD 400 / day`;
  - IP card `asset-afya-triage`, cohort `cohort-2026a`, partner `amani-health`.
- [ ] Playwright, Constrained brief: shows the `Partial` badge. The Gaps panel precedes the team section in DOM order (asserted with `compareDocumentPosition`). The single gap shows rule `route-gap`, affected `mobile`, and exactly two next-action buttons with the D-29 texts. One builder card: Zawadi Njoroge.
- [ ] Playwright, Delivery-mode challenge: `Infeasible`, three location gaps (python, ai-metta, ui-ux), the empty team state, and no IP, cohort or partner cards.
- [ ] Playwright: open Why this route? on the Health pilot. The Founder view lists the partner path with rule `partner-fit` and these 4 facts in order: `(supports-vertical amani-health health)`, `(partners-with amani-health omni-university)`, `(cohort-of cohort-2026a omni-university)`, `(belongs-to amina-otieno cohort-2026a)`. The Technical view toggle shows the same facts in monospace.
- [ ] Playwright: on the Health pilot review screen, change the budget chip to 250 → the route is re-computed → `Partial`, no builder cards, one budget gap with rule `assembler.budget-fit` and a button `Raise daily budget to USD 370`. Clicking the button sets the chip to 370 and the re-computed route is `Feasible`.
- [ ] Playwright: the form path ("Use the form instead", filled with the Agri marketplace values) and the chat path (Agri scenario loaded then confirmed) render the same builder IDs in the same order: wanjiru-mwangi, lucy-achieng, fatuma-hassan.
- [ ] Vitest: `handoffText(brief, route)` for the Health pilot contains the status, three team lines with day rates, `USD 370 / day`, the IP, cohort, partner and rules applied, and the demo-data disclaimer. It does not contain `route.summary` (the test sets `summary` to a sentinel string and asserts its absence).
- [ ] PWA (D-32), Playwright on `vite preview`: the manifest fields and 192/512 icons (one maskable) are present, `navigator.serviceWorker.ready` resolves with a controller after a reload, and the app shell renders with the context offline.
- [ ] Vitest + RTL:
  - a review-chip edit to budget 0 renders the Zod error inline, and a `validation-error` response `dailyBudget: …` renders on the budget field;
  - the status badge maps `feasible|partial|infeasible` → `Feasible|Partial|Infeasible`;
  - the evidence badge maps to its three labels;
  - gaps-first ordering holds for a partial route.
- [ ] CI: the `engine` and `web` jobs in `.github/workflows/ci.yml` are green on the PR head (link to the run in the report). Locally, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -F web e2e` and the engine suite are green. `STATE.md` is updated.

## Should
- [ ] Landing page renders all six sections at 1440 and 1024 px without horizontal scroll (Playwright asserts `scrollWidth <= innerWidth`, screenshots attached to the report).
- [ ] With `VITE_OFFLINE_DEMO=1` and the engine stopped, all five scenarios render their routes and the banner reads "Offline demonstration mode".
- [ ] `web-design-guidelines` audit run on the five screens; findings fixed or listed in the report.
