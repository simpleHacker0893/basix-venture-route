# CLAUDE.md

Read `AGENTS.md` first. It holds the operating rules, roles, stack, and sprint process for Venture Route.

Then read, in order: `planning/STATE.md`, `planning/DECISIONS.md`, `planning/DOMAIN.md`, `planning/TIMELINE.md`, and the current sprint folder under `planning/sprints/`.

Skills are installed under `.claude/skills/` (restore with `npx skills experimental_install`). The Builder process is Matt Pocock's chain: `/setup-matt-pocock-skills` once, then per sprint `/to-tickets` → `/implement` (with `tdd` at the seams in `planning/PROMPTS.md`) → `/code-review master`. The exact prompts to paste are in `planning/PROMPTS.md`. Neon Postgres is the store (D-17); never use the Convex skill.

Never write application code from the `120x-architect` role. Never claim a sprint complete without running the commands in its `acceptance.md` and pasting the output.
