# AGENTS.md — Venture Route operating rules

Read this file first in every session. Then read `planning/STATE.md`, `planning/DECISIONS.md`, `planning/DOMAIN.md`, and the current sprint folder under `planning/sprints/`. The folder is the source of truth; chat is not.

## What this project is

Venture Route turns a founder's plain-language venture brief into an evidence-backed route through the BASIX ecosystem. MeTTa (Hyperon runtime) decides eligibility and evidence. A language model translates and explains. It never selects people, invents proof, or claims a route is verified. See `planning/DOMAIN.md` for terms and rules.

Demo: Thursday 1 October 2026, BASIX hackathon, SingularityNET MeTTa track. Timeline in `planning/TIMELINE.md`.

## Roles

| Role | Who | Does |
|---|---|---|
| Operator | Njuguna Njenga (Cpt. N) | Approves sprints, merges PRs, runs Stitch, owns the demo |
| Architect | Claude (120x-architect skill) | Writes planning artifacts, reviews Builder completion reports against `acceptance.md`. Never writes application code |
| Builder | Claude Code session (cloud or local) | Implements one sprint from its `handoff-prompt.md`, opens one PR per sprint |
| Reviewer | Claude Code subagent `sprint-reviewer` | Two-axis review of the sprint diff (standards + spec) before the PR is marked ready |

## Non-negotiables

1. **MeTTa is the only decision layer.** Eligibility, evidence, availability, mode/location fit, reuse fit, partner fit, and skill/availability/mode/location gaps come from named MeTTa rules over facts. Never replace them with a Python or TypeScript matcher, even temporarily.
2. **Status is deterministic.** `feasible | partial | infeasible` is computed by the route service from the engine's gap set and team coverage (`planning/DECISIONS.md` D-09). The LLM explains the status; it does not choose it.
3. **The LLM boundary** (PRD §5.7) is enforced in code: the explanation adapter receives only the structured `VentureRoute`, never raw graph data. System instruction verbatim in `planning/DOMAIN.md`.
4. **Self-described skills are display-only.** They never satisfy `verified-for-skill`.
5. **Demo data is labelled.** Every seed-derived and user-entered record carries `demoData: true` and the UI shows the Demo data pill.
6. **Gaps before team cards.** A partial route renders its gaps panel above any builder card.
7. **Form fallback always works.** Every LLM step has a structured-form path that produces the same brief and the same route.
8. **No secrets in the repo.** Keys live in `.env` (ignored); `.env.example` lists every variable with a comment.
9. **Tests are the gate.** A sprint is done only when every line of its `acceptance.md` is checked with fresh evidence (command + output). Never skip, disable, or quarantine a test to get green.
10. **No invented business facts.** If a threshold, rule, or record is unknown, add it to `planning/QUESTIONS.md` and stop at the seam; do not guess.

## Stack (decided, see DECISIONS.md)

- `services/engine`: Python 3.12, FastAPI, Pydantic v2, `hyperon==0.2.10` in-process, `anthropic` SDK, `convex` Python client 0.8.x. Managed with `uv`. Tests: pytest.
- `apps/web`: React 18 + Vite + TypeScript, Tailwind, shadcn/ui, vite-plugin-pwa, Clerk React, Convex React client. Tests: Vitest + React Testing Library + Playwright.
- `convex/`: Convex functions and schema (marketplace data), Clerk auth via `convex/auth.config.ts`. CLI: `npx convex dev`, `npx convex deploy`. MCP: `npx convex@latest mcp start`.
- `packages/contracts`: Zod schemas for `VentureBrief`, `VentureRoute`, `ChatResponse`; JSON Schema exported for the Pydantic mirror test.
- Root: Turborepo, Docker Compose (`engine`, `web`), `.env.example`.
- Deploy: web on Vercel; engine container on Railway (Render as fallback); Convex cloud.

## How a sprint runs

1. Builder starts from `planning/sprints/<sprint>/handoff-prompt.md` on branch `sprint/<sprint>`.
2. Builder runs the Matt Pocock `to-tickets` skill on `requirements.md` to slice tracer-bullet tickets into `planning/sprints/<sprint>/tickets/`, then `implement` with `tdd` per ticket, then `code-review` before the PR.
3. Builder opens one PR titled `Sprint <NNN>: <name>` whose body is the completion report (`planning/AUTOMATION.md` §Completion report). The PR must not be marked ready until every `acceptance.md` line has evidence.
4. Architect reviews the report against `acceptance.md`; Operator merges. Merge of sprint N is the only trigger for sprint N+1.
5. `planning/STATE.md` is updated in the same PR: what shipped, what did not, what the next sprint inherits.

## Conventions

- Commits: Conventional Commits (`feat(engine): …`, `test(web): …`, `docs(planning): …`).
- Python: ruff + mypy strict on `services/engine`; TypeScript: strict mode, eslint.
- Dates are ISO `YYYY-MM-DD`, date-only, Africa/Nairobi. Money is integer USD per day.
- IDs are stable kebab-case slugs from seed files (`amina-otieno`, `cred-py-201`). Never rename a seed ID.
- MeTTa rule names are the identifiers in `planning/DOMAIN.md`; do not invent new rule names without a DECISIONS entry.

## Adapters

`CLAUDE.md` is a thin pointer to this file. There is no `CODEX.md`.
