# Sprint 004 — acceptance

## Must
- [ ] Founder publishes a request from the Health brief; the requests board shows it to a signed-in builder with the eligibility indicator computed by the engine (`eligible-builder` path present in the response).
- [ ] An eligible builder's bid is stored; an ineligible builder's bid attempt returns 403 with the reason and the UI button is disabled with the same text.
- [ ] Booking round-trip in Playwright: founder proposes → builder counters → founder accepts → state `confirmed`; history has three entries.
- [ ] Founder dashboard tiles match SQL counts.
- [ ] `alembic upgrade head` clean; `pnpm -r test`, Playwright, `uv run pytest -q` green; `STATE.md` updated.

## Should
- [ ] Closing a request disables bidding and hides it from the board's "Eligible for me" filter.
