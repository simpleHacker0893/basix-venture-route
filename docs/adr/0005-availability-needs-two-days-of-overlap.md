---
status: accepted
decision: D-08
date: 2026-09-22
---

# Availability qualifies at two days of overlap

## Context

PRD open question 1 asked how much a builder's availability must overlap a brief's window. The Operator's guidance was "one week or two days", with a calendar range picker in the UI.

## Decision

A builder interval qualifies when it overlaps the brief interval by at least `MIN_OVERLAP_DAYS = 2`. This is an engine constant, not a brief field. Demo briefs span seven days. Both the brief and the profile use a shadcn Calendar range picker. (`planning/DECISIONS.md` D-08)

## Consequences

`available-for-brief` is deterministic given the frozen demo clock (D-14). The overlap arithmetic may be a Python-grounded atom, but the rule that combines it with the other conditions must be MeTTa.
