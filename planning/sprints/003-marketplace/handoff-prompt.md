DRAFT — finalised by the Architect after the Sprint 002 Builder Review.

You are the Builder for Venture Route, Sprint 003 — Marketplace. Before any work: fetch origin. If the PR "Sprint 002: Founder UI" is not merged, comment on it that Sprint 003 is waiting, and stop. Otherwise create `sprint/003-marketplace` from `master`. If `planning/STATE.md` says the scope floor was triggered at G2, build only the scope-floor variant in `requirements.md`.

Read `AGENTS.md`, `planning/STATE.md`, `planning/DECISIONS.md` (D-02, D-03, D-15), `planning/DOMAIN.md`, this sprint's files. Install the Convex skill (`npx skills add https://github.com/get-convex/agent-skills --skill convex`) and use `npx convex dev`; the Convex MCP (`npx convex@latest mcp start`) may be used for schema and data inspection. Use the Clerk MCP snippets for provider setup. Slice with `to-tickets`, build with `implement` + `tdd`, review per ticket, `code-review` before the PR `Sprint 003: Marketplace`.
