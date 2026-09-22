---
status: accepted
decision: D-07
date: 2026-09-22
---

# partner-fit is a four-hop chain through partners-with

## Context

A one-hop lookup from vertical to partner is unconvincing to a MeTTa-track judge, who needs a multi-hop result over named facts.

## Decision

The headline chain includes a `partners-with (partner, university)` edge: brief vertical → `supports-vertical` partner → `partners-with` university → `cohort-of` cohort → `belongs-to` builder. Four hops in one `partner-fit` query. (`planning/DECISIONS.md` D-07)

## Consequences

Seed data must carry `partners-with` facts for every partner that should appear in a route. The partner is chosen for a selected builder, so it depends on team assembly having already run.
