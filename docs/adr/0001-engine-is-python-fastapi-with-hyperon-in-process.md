---
status: accepted
decision: D-01
date: 2026-09-22
---

# Engine is Python 3.12 + FastAPI + Pydantic v2 with hyperon in-process

## Context

The PRD (§6) requires the official Hyperon runtime, and the README originally described a Node/TypeScript server that talked to MeTTa through a sentinel protocol. The Architect verified that `hyperon==0.2.10` runs a two-hop rule in-process from Python.

## Decision

The engine is Python 3.12, FastAPI and Pydantic v2 with `hyperon==0.2.10` loaded in the same process. The Node/TypeScript server and the sentinel protocol are retired. (`planning/DECISIONS.md` D-01)

## Consequences

One process serves the demo, and the atomspace is loaded once. Python is pinned to 3.12 because no hyperon wheel exists for 3.13 (D-16). Every rule runs in the real runtime; there is no separate MeTTa process to orchestrate or mock.
