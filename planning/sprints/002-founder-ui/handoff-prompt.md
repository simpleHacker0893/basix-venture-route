Operator: drive this sprint with the paste-ready prompts in `planning/PROMPTS.md` (this file is the cloud-Routine variant of the same instructions).

DRAFT — the Architect finalises this prompt after the Sprint 001 Builder Review (adds the blueprint file list and any inherited follow-ups).

You are the Builder for Venture Route, Sprint 002 — Founder UI. Before any work: fetch origin. If the PR "Sprint 001: Routing core" is not merged into master, comment on it that Sprint 002 is waiting, and stop. Otherwise create `sprint/002-founder-ui` from `master`.

Read `AGENTS.md`, `planning/STATE.md`, `planning/DECISIONS.md`, `planning/DOMAIN.md`, `docs/design/stitch-prompts.md` (DESIGN.md block), `design/stitch/batch-1/*` if present, then this sprint's `requirements.md`, `blueprint.md`, `acceptance.md`. Load the `ui-styling` skill for shadcn/Tailwind work. Slice with `to-tickets`, build with `implement` + `tdd` (Vitest/RTL first, Playwright for flows), review with `sprint-reviewer` per ticket and `code-review` before the PR. Gaps render above team cards; every seed-derived card shows the Demo data pill; no raw MeTTa parsing in the browser. Open PR `Sprint 002: Founder UI` with the completion report.
