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

- `services/engine`: Python 3.12, FastAPI, Pydantic v2, `hyperon==0.2.10` in-process, `anthropic` SDK, SQLModel + Alembic + `asyncpg` against Neon Postgres. Managed with `uv`. Tests: pytest (marketplace tests run against a Neon branch or the compose `db`).
- `apps/web`: React 19 + Vite + TypeScript, Tailwind, shadcn/ui, vite-plugin-pwa, Clerk React. Talks only to the FastAPI service. Tests: Vitest + React Testing Library + Playwright.
- `packages/contracts`: Zod schemas for `VentureBrief`, `VentureRoute`, `ChatResponse`; JSON Schema exported for the Pydantic mirror test.
- Root: Turborepo, Docker Compose (`engine`, `db`, `web`), `.env.example`.
- Deploy: web on Vercel; engine container on Railway (Render as fallback); database on Neon (Neon CLI/MCP for branches).

## How a sprint runs

1. Builder starts from `planning/sprints/<sprint>/handoff-prompt.md` on branch `sprint/<sprint>`.
2. Operator drives the Matt Pocock skills from `planning/PROMPTS.md`: `/to-tickets` on `requirements.md` (tickets published as GitHub Issues labelled `ready-for-agent`, sprint label `sprint:NNN`), `/implement` per ticket (runs `tdd` at the sprint's fixed seams and `code-review`), `/code-review master` before the PR.
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

## Installed skills (project scope, `.claude/skills/` and `skills-lock.json`)

Restore on a fresh clone with `npx skills experimental_install`. The Stitch plugin is pinned in `.claude/settings.json`; Playwright CLI: `npm i -g @playwright/cli && playwright-cli install --skills`.

| When | Use |
|---|---|
| Planning, any sprint | `setup-matt-pocock-skills` (once), `domain-modeling`, `codebase-design`, `grilling`, `grill-me`, `to-tickets`, `implement`, `tdd`, `code-review` (Matt Pocock; prompts in `planning/PROMPTS.md`); `brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, `verification-before-completion` (superpowers) |
| Sprint 000–001 engine | `fastapi-clean-architecture`, `secure-coding`, `docker-project-foundations`, `docker-build-strategies` |
| Sprint 002 web | `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `playwright-cli`; Stitch plugins `stitch-build` (`shadcn-ui`, `react-components`, `react-vite-dashboard`), `stitch-design` (`generate-design`, `extract-design-md`, `code-to-design`), `stitch-utilities` (`design-md`, `enhance-prompt`) |
| Sprint 003–004 marketplace | `neon-postgres`, `fastapi-clean-architecture` (Clerk JWT section), `clerk-setup`, `clerk-react-patterns`, `clerk-cli`, `clerk-webhooks`, `clerk-testing`, `clerk-backend-api` |
| Sprint 005 deploy | `docker-compose-patterns`, `deploy-to-vercel`, `use-railway`, `docker-vps-deploy` (Render/VPS fallback only) |
| Not used by this project (installed, kept for reference) | `convex` (superseded by D-17), `redis-*`, `iris-development`, `clerk-android`, `clerk-expo`, `clerk-swift`, `clerk-nextjs-patterns`, `clerk-nuxt-patterns`, `clerk-vue-patterns`, `clerk-astro-patterns`, `clerk-tanstack-patterns`, `clerk-react-router-patterns`, `clerk-chrome-extension-patterns`, `clerk-billing`. D-17 makes Neon Postgres the store; the Convex or Redis skills must not be used without a superseding decision. |
