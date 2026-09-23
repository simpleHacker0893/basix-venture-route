Operator: drive this sprint with the paste-ready prompts in `planning/PROMPTS.md` §Sprint 006. This file is the cloud-Routine variant of the same instructions.

DRAFT — the Architect finalises this prompt after the Sprint 005 Builder Review and once the Operator sets the window (Q-13).

You are the Builder for Venture Route, Sprint 006 — Chloe voice intake. Repo: simpleHacker0893/basix-venture-route.

Before any work: fetch origin. If the PR "Sprint 005: Demo hardening" is not merged into master, post one comment on it saying Sprint 006 is waiting, and stop. Otherwise create `sprint/006-chloe-voice` from `origin/master`.

Read in order:
1. `AGENTS.md`, `CONTEXT.md`, `planning/STATE.md`
2. `planning/DECISIONS.md` (D-19, D-26, D-36, D-38 matter most), `planning/DOMAIN.md` (the LLM boundary), `docs/API.md`
3. `docs/design/stitch-prompts.md` (the DESIGN.md block and §5.1), and `design/stitch/batch-5/founder-intake-voice/*`
4. `planning/sprints/006-chloe-voice/requirements.md`, `blueprint.md`, `acceptance.md`, and `review.md` in `005-demo-hardening`

Summarise in ten lines and list blocking questions. Stop if one blocks the first ticket.

Skills:
- Process: Matt Pocock `to-tickets` (GitHub Issues, label `sprint:006`), `implement` + `tdd` at the seams in `planning/PROMPTS.md` §Sprint 006, `code-review master` before the PR.
- Screens: `stitch-build:react-components` and `stitch-build:shadcn-ui` for the batch-5 export; `ui-styling`; `vercel-react-best-practices`; `vercel-composition-patterns`.
- Testing and audit: `playwright-cli`; `web-design-guidelines` for the final audit.
- Never the Convex skill. No engine work this sprint.

Hard rules for this sprint:
- `POST /api/conversation` and its contract do not change. No file under `packages/contracts`, `services/engine/app/models`, `services/engine/app/conversation` or `services/engine/seed` is touched.
- Chloe speaks only text templated from `ChatResponse` and `VentureRoute`. She never names a builder the route does not carry, never invents evidence, never names a rule that did not fire.
- Every request Chloe causes goes through the existing `sendTurn`; the "yes" path posts `{ userMessage: "", currentBrief }`, the same as the button.
- Push-to-talk only; the greeting is spoken inside the toggle click handler; the mic is disabled while `busy`.
- Keyless engine (form-fallback hint) → one announcement, then dictation only.
- No voice UI when `VITE_OFFLINE_DEMO=1`; unsupported browsers get the caption, not a broken mic.
- Tests only at the seams: rendered screens through RTL with the fake provider, Playwright with `VITE_VOICE_PROVIDER=fake`.

Finish: run every command in `acceptance.md` (CI run link included), update `planning/STATE.md`, push, and open one PR `Sprint 006: Chloe voice intake` with the completion report from `planning/AUTOMATION.md`. Mark it ready only with evidence on every Must line.
