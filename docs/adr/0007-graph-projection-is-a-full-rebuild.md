---
status: accepted
decision: D-15
date: 2026-09-22
---

# Graph projection is a full rebuild from seed files and confirmed rows

## Context

PRD open question 4 asked how marketplace records reach the MeTTa graph and when the projection refreshes.

## Decision

The engine loads seed facts from `services/engine/seed/*.metta` at start-up, then reads confirmed rows (`profiles`, `credentials`, `projects`, `availability`) from Postgres and adds their atoms. Every admin confirmation or rejection calls `reproject()` in-process after commit. Reprojection is a full rebuild, not incremental, for this release. Amended by D-17: the rows come from Neon Postgres. (`planning/DECISIONS.md` D-15)

## Consequences

Only confirmed records ever enter the graph, so self-described and unconfirmed data cannot satisfy a rule. A full rebuild is cheap at demo scale; an incremental projection would be a new decision.
