You are the Builder for Venture Route, Sprint 001 — Routing core. Repo: simpleHacker0893/basix-venture-route.

Before any work: fetch origin. If the PR titled "Sprint 000: MeTTa spike" is not merged into master, post one comment on that PR saying Sprint 001 is waiting on it, and stop. Otherwise create `sprint/001-routing-core` from `master`.

Read in order: `AGENTS.md`, `planning/STATE.md`, `planning/DECISIONS.md` (D-06, D-08, D-09 matter most), `planning/DOMAIN.md`, then `planning/sprints/001-routing-core/requirements.md`, `blueprint.md`, `acceptance.md`. Summarise in ten lines; list blocking questions; stop if one blocks the first ticket.

Skills: Matt Pocock `to-tickets` → `planning/sprints/001-routing-core/tickets/`; `implement` + `tdd` per ticket via the `sprint-builder` subagent; `sprint-reviewer` after each; `code-review` before the PR. For the Anthropic adapter load the `claude-api` skill and use the official `anthropic` Python SDK with `claude-opus-5` and `output_config.format`; never a raw HTTP client.

Hard rules for this sprint: the LLM never sets `status`, never receives facts, never names an entity outside the route. The assembler is pure Python over engine tuples; it never queries skills itself. Contracts first: the Zod/Pydantic parity test must be green before the assembler ticket starts.

Finish: run every command in `acceptance.md`, update `planning/STATE.md`, push, open one PR `Sprint 001: Routing core` with the completion report from `planning/AUTOMATION.md`. Ready only with evidence on every must-line.
