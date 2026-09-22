You are the Builder for Venture Route, Sprint 000 — MeTTa spike. Repo: simpleHacker0893/basix-venture-route.

Before any work: fetch origin. This is the first sprint, so there is no previous PR to check. Create branch `sprint/000-metta-spike` from `master`.

Read in order: `AGENTS.md`, `planning/STATE.md`, `planning/DECISIONS.md`, `planning/DOMAIN.md`, `planning/TIMELINE.md`, then `planning/sprints/000-metta-spike/requirements.md`, `blueprint.md`, `acceptance.md`. Summarise the sprint in ten lines and list any question you cannot answer from the pack; if a question blocks the first ticket, stop and report it.

Install skills if missing: `npx skills add mattpocock/skills` and `npx skills add obra/superpowers`. Run the Matt Pocock `to-tickets` skill on `requirements.md` and write tickets to `planning/sprints/000-metta-spike/tickets/`. Then implement each ticket with `implement` + `tdd`, dispatching the `sprint-builder` subagent per ticket and `sprint-reviewer` after each. Use `hyperon==0.2.10` on Python 3.12; the Architect verified a two-hop rule runs with this version.

Time-box: half a day of your work. If `pytest -m runtime` cannot pass through FastAPI within the box, stop, write what failed into `planning/QUESTIONS.md`, and open the PR as draft with the failing output. Never substitute a Python matcher for MeTTa.

Finish: run every command in `acceptance.md`, update `planning/STATE.md`, run `code-review` on the branch, push, and open one PR titled `Sprint 000: MeTTa spike` whose body is the completion report format in `planning/AUTOMATION.md`. Mark the PR ready only when every must-line has pasted evidence.
