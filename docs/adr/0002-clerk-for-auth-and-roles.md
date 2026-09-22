---
status: accepted
decision: D-03
date: 2026-09-22
---

# Clerk for authentication and roles

## Context

The marketplace needs sign-up, sign-in and three roles (`founder`, `builder`, `admin`) that the web app can read without a round trip, while the FastAPI service must enforce them (PRD §6 Auth row).

## Decision

Auth is Clerk. The role is chosen at sign-up and stored in Clerk `publicMetadata.role`. The FastAPI marketplace API verifies the Clerk JWT and reads the role claim. A Clerk `user.created` / `user.updated` webhook upserts the `users` row. The first admin is bootstrapped from an `ADMIN_EMAILS` environment variable in the engine. Amended by D-17: the `users` row lives in Neon Postgres. (`planning/DECISIONS.md` D-03)

## Consequences

Roles are available client-side immediately. Routing stays public (D-04); Clerk gates only marketplace screens. Tests need a fake Clerk JWT signed by a test JWKS, and the webhook must be forwarded locally during development.
