---
status: accepted
decision: D-09
date: 2026-09-22
---

# Gap ownership and deterministic route status

## Context

PRD open question 2 asked which layer owns each gap and who sets the route status. The Operator's wording ("use LLM to emit partial or infeasible based on route-gap") could be read as letting the model choose the status, which would break the LLM boundary (PRD §5.7) and the judge test.

## Decision

MeTTa `route-gap` emits `skill`, `availability`, `mode` and `location` gaps per required skill. The Python assembler emits `team-size` and `budget` gaps under the named rules `assembler.team-size-fit` and `assembler.budget-fit`. Status is a pure function: all skills covered and a subset survives → `feasible`; some skill covered or any gap → `partial`; no builder eligible for any skill → `infeasible`. The LLM writes the summary and explains the status and next actions; it never sets the status value. (`planning/DECISIONS.md` D-09)

## Consequences

Status is testable without a model and identical on the form and chat paths. The Architect's reading of the Operator's wording is flagged as an assumption in `planning/QUESTIONS.md` Q-01 and awaits confirmation.
