---
status: accepted
decision: D-17
date: 2026-09-22
---

# Neon Postgres is the marketplace store

## Context

D-02 had placed marketplace data in Convex on the morning of 2026-09-22. That afternoon the Operator decided "we are going to use Neon", which also matches PRD §6 as written and keeps one backend language.

## Decision

The marketplace store is Neon Postgres through the FastAPI service: SQLModel models, Alembic migrations, `asyncpg`, one pooled `DATABASE_URL`. Local development uses the compose `db` service; CI and the demo use a Neon branch. No Convex, no Prisma, no Node marketplace API. Supersedes D-02 and amends D-03, D-05 and D-15. (`planning/DECISIONS.md` D-17)

## Consequences

The installed Convex and Redis skills must not be used without a superseding decision. Every table carries `demo_data` defaulting to true with a check constraint. Neon branches provide demo resets.
