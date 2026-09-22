Operator: drive this sprint with the paste-ready prompts in `planning/PROMPTS.md` §Sprint 002. This file is the cloud-Routine variant of the same instructions.

You are the Builder for Venture Route, Sprint 002 — Founder UI. Repo: simpleHacker0893/basix-venture-route.

Before any work: fetch origin. If the PR "Sprint 001: Routing core" (#20) is not merged into master, post one comment on it saying Sprint 002 is waiting, and stop. Otherwise create `sprint/002-founder-ui` from `origin/master`.

Read in order:
1. `AGENTS.md`, `CONTEXT.md`, `planning/STATE.md` (§What Sprint 002 inherits)
2. `planning/DECISIONS.md` (D-25, D-29 to D-34 matter most), `planning/DOMAIN.md`, `docs/API.md`
3. `docs/design/stitch-prompts.md` (the DESIGN.md block), and `design/stitch/batch-1/*` and `batch-2/*` if present
4. `planning/sprints/002-founder-ui/requirements.md`, `blueprint.md`, `acceptance.md`, and `review.md` in `001-routing-core`

Summarise in ten lines and list blocking questions. Stop if one blocks the first ticket.

Skills:
- Process: Matt Pocock `to-tickets` (GitHub Issues, label `sprint:002`), `implement` + `tdd` at the seams in `planning/PROMPTS.md` §Sprint 002, `code-review master` before the PR.
- Screens: `stitch-build:react-components` and `stitch-build:shadcn-ui` for converting exports; `ui-styling`; `vercel-react-best-practices`; `vercel-composition-patterns`.
- Testing and audit: `playwright-cli`; `web-design-guidelines` for the final audit.
- Never the Convex skill. No Clerk this sprint.

Hard rules for this sprint:
- The first ticket is the engine prerequisites (CORS D-30, offline snapshot D-34, placeholder key → NullAdapter). The second is the scaffold with CI green (D-33).
- Gaps render before team cards in DOM order.
- Every seed-derived card shows the Demo data pill.
- The browser never parses MeTTa and never redefines a contract type.
- The handoff never includes `route.summary`.
- The Technical view renders `ReasoningPath` only (D-31).
- Playwright runs against `vite preview` with the engine on `LLM_PROVIDER=null`.

Finish: run every command in `acceptance.md` (CI run link included), update `planning/STATE.md`, push, and open one PR `Sprint 002: Founder UI` with the completion report from `planning/AUTOMATION.md`. Mark it ready only with evidence on every Must line.
