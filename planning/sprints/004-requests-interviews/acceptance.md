# Sprint 004 — acceptance

## Must
- [ ] Founder publishes a request from the Health brief; the requests board shows it to a signed-in builder with the eligibility indicator computed by the engine (`eligible-builder` path present in the response).
- [ ] An eligible builder's bid is stored; an ineligible builder's bid attempt is rejected server-side (Convex mutation throws) and the UI button is disabled with the reason.
- [ ] Booking round-trip in Playwright: founder proposes → builder counters → founder accepts → state `confirmed`; history has three entries.
- [ ] Founder dashboard tiles match Convex counts.
- [ ] `pnpm -r test`, Playwright, `uv run pytest -q`, `npx convex dev --once` green; `STATE.md` updated.

## Should
- [ ] Closing a request disables bidding and hides it from the board's "Eligible for me" filter.
