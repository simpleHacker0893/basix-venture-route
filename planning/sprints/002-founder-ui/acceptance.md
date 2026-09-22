# Sprint 002 — acceptance

## Must
- [ ] Playwright: load "Health pilot" scenario → review → Find my route → route screen shows `Feasible`, 3 builder cards each with an evidence badge and a Demo data pill, cost strip `USD 370` vs `USD 400`.
- [ ] Playwright: "Constrained brief" → `Partial`, Gaps panel rendered above the team section (DOM order asserted), gap names `route-gap`, one next action button.
- [ ] Playwright: open Why this route? → Founder view lists ≥ 4 ordered facts for the partner path with rule `partner-fit`.
- [ ] Playwright: change budget to 250 on the review screen → route re-computed → budget gap shown.
- [ ] Playwright: form path with the API `LLM_PROVIDER=null` yields the same route as the chat path (compare rendered builder IDs).
- [ ] Handoff export text contains status, team lines, total, IP, cohort, partner, rules applied, and the demo-data disclaimer; no LLM text.
- [ ] PWA: manifest valid, service worker registered, Lighthouse PWA installable check passes in CI (`pnpm -F web lighthouse` or `@lhci/cli`).
- [ ] Vitest + RTL: chips edit → Zod validation error rendered; status badge text mapping; gaps-first ordering unit test.
- [ ] `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, Playwright suite green in CI; `STATE.md` updated.

## Should
- [ ] Landing page renders all six sections at 1440 and 1024 px without horizontal scroll (Playwright screenshot diff).
- [ ] Offline demo flag renders all five seed routes without the API.
