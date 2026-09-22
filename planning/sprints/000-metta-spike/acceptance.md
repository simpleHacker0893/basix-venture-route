# Sprint 000 — acceptance

Done means every **must** line has a command and pasted output in the PR completion report.

## Must
- [ ] `uv run pytest -q -m runtime` passes on Python 3.12 with `hyperon==0.2.10` installed; the test fails (not skips) when hyperon is absent.
- [ ] `eligible-builder` for `brief-health-01` returns `amina-otieno` for `python` with evidence `both` and a path whose facts list both the credential chain and the project chain.
- [ ] `partner-fit` for `brief-health-01` returns `amani-health` with exactly four facts in order: `supports-vertical`, `partners-with`, `cohort-of`, `belongs-to`.
- [ ] A builder with only `has-self-described-skill` for a required skill never appears in `eligible-builder` output.
- [ ] `route-gap` for `brief-constrained-01` yields category `skill` for `mobile` and no gap for `rust`.
- [ ] Overlap threshold: a builder overlapping the brief by 1 day is not available; by 2 days is available.
- [ ] `GET /health` returns 200 with `facts_loaded > 0` and `rules_loaded == 7` inside `docker compose up engine`.
- [ ] `uv run ruff check .` and `uv run mypy app` report zero errors.
- [ ] No Python function selects builders by skill without calling the MeTTa space (reviewer greps for list comprehensions over facts; none exist outside parsers).
- [ ] `STATE.md` updated in the PR.

## Should
- [ ] `POST /internal/query` documented in `docs/API.md` as dev-only.
- [ ] Seed facts total ≥ 120 atoms with a `; demo-data` header.
