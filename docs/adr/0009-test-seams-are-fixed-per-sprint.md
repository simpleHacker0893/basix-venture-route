---
status: accepted
decision: D-19
date: 2026-09-22
---

# Test seams are fixed per sprint

## Context

The `tdd` skill refuses to write a test at an unconfirmed seam, and a nine-day timeline leaves no room to renegotiate seams mid-sprint.

## Decision

Test seams are fixed per sprint in `planning/PROMPTS.md`: for the engine, `MettaRouteEngine` methods and the HTTP endpoints; for the web app, rendered screens via React Testing Library and Playwright; for the marketplace, HTTP endpoints against a Neon test branch. `tdd` tests only at these seams. (`planning/DECISIONS.md` D-19)

## Consequences

No component-internal or private-function tests. A new seam requires a `planning/DECISIONS.md` entry before a test is written there.
