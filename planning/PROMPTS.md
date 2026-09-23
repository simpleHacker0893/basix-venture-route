# PROMPTS — paste-ready Claude Code prompts, Sprint 000 → deployment

Every prompt below is written to be pasted into Claude Code inside this repo, one at a time, in order. They drive Matt Pocock's skills the way the skills are designed: **you** type the slash commands (`/to-tickets`, `/implement`, `/code-review` are `disable-model-invocation`; the model cannot start them itself), tests are written only at **pre-agreed seams** (the `tdd` skill refuses otherwise), and every sprint ends with `verification-before-completion` evidence, not a claim.

Rhythm per sprint: **Orient → `/to-tickets` → `/implement` (loop over the frontier) → `/code-review master` → Acceptance + PR → Architect review**. One Claude Code session per sprint. If a session dies, use the Resume prompt.

Tracker: GitHub Issues on `simpleHacker0893/basix-venture-route` (needs `gh auth login` on your laptop). Fallback: answer "Local markdown" in Prompt 0 and tickets go to `.scratch/`.

---

## Prompt 0 — one-time setup (run once, before Sprint 000)

```text
Read AGENTS.md, planning/DECISIONS.md and planning/DOMAIN.md. Then run /setup-matt-pocock-skills with these answers: issue tracker = GitHub (this repo, gh CLI); triage labels = defaults; domain docs = single-context (root CONTEXT.md + docs/adr/). Edit CLAUDE.md, not AGENTS.md, and keep every existing section.

After setup, run /domain-modeling to create CONTEXT.md from planning/DOMAIN.md: glossary entries for Venture brief, Route, Evidence type, Reasoning path, Gap, Self-described skill, Demo data, the nine skill IDs, the seven MeTTa rule names, and the two assembler rule names. Then write one ADR per decision D-01, D-03, D-06, D-07, D-08, D-09, D-15, D-17, D-19 under docs/adr/ (title, status Accepted, context, decision, consequences), each citing its D-number. Do not invent facts; if DOMAIN.md is silent, leave the entry out and list it for me.

Create GitHub labels sprint:000, sprint:001, sprint:002, sprint:003, sprint:004, sprint:005 (colour #1e5a45) and ready-for-agent if missing. Commit as "chore: configure Matt Pocock skills, CONTEXT.md and ADRs" on branch claude/nifty-newton-i607nd and push. Report the files written.
```

---

## Spec-first variant (Sprint 003 onward): S0 → S1 → P2 → P3 → P4 → P5

From Sprint 003 the Operator asked for a written spec before tickets. The chain becomes: **P1 Orient → S0 `brainstorming` (superpowers, architectural path) → S1 `/to-spec` (Matt Pocock, publishes the spec as a GitHub issue labelled `ready-for-agent`) → P2 `/to-tickets <spec issue>` → P3 `/implement` → P4 `/code-review master` → P5 evidence + PR**. The sprint `requirements.md` and `blueprint.md` stay the Architect's input; the spec issue is the Builder's synthesis of them plus the seams, and it becomes the Spec source for `/code-review`.

### S0 — Brainstorm the design (superpowers `brainstorming`, one question per message)

```text
Use the brainstorming skill. This is an architectural change: classify it so out loud. Ground everything in planning/sprints/NNN-<slug>/requirements.md, blueprint.md, acceptance.md, CONTEXT.md, docs/adr/ and the decisions I name in P1. Write back your understanding first, separating what the pack says from what you assume. Ask me one question at a time, only where the pack is silent; prefer multiple choice. Propose 2 to 3 approaches only where the blueprint leaves a choice open, with your recommendation. Present the design in sections and stop for my approval after each. Do not write the spec file yet; when I approve the last section, stop and wait for /to-spec.
```

### S1 — Publish the spec (Matt Pocock `to-spec`)

```text
/to-spec

Synthesize the approved design from this conversation plus planning/sprints/NNN-<slug>/requirements.md and blueprint.md into the spec template. Seams are the ones fixed in planning/PROMPTS.md §Sprint NNN; confirm them with me before writing. User stories come from requirements.md and PRD §3; Implementation Decisions cite D-numbers; Testing Decisions cite the seams and the acceptance.md lines; Out of Scope copies requirements.md §Out of scope. Publish as one GitHub issue titled "Spec: Sprint NNN — <name>" labelled sprint:NNN and ready-for-agent. Give me the issue number.
```

Then P2 becomes `/to-tickets #<spec issue>` (the parent reference is the spec issue; every ticket links it), and P4's Spec source is that issue.

## The five prompts you paste in every sprint

Replace `NNN` and `<slug>` with the sprint (`000-metta-spike`, `001-routing-core`, `002-founder-ui`, `003-marketplace`, `004-requests-interviews`, `005-demo-hardening`). Sprint-specific lines to append are in the next section.

### P1 — Orient (first message of the sprint session)

```text
You are the Builder for Venture Route, Sprint NNN. Fetch origin. If the previous sprint's PR ("Sprint <N-1>: …") is not merged into master, tell me and stop. Otherwise create and check out branch sprint/NNN-<slug> from origin/master.

Read, in order: AGENTS.md, CLAUDE.md, CONTEXT.md, planning/STATE.md, planning/DECISIONS.md, planning/DOMAIN.md, planning/TIMELINE.md, then planning/sprints/NNN-<slug>/requirements.md, blueprint.md (if present) and acceptance.md.

Reply with: (1) the sprint goal in two lines, (2) the seams we will test at, taken from planning/PROMPTS.md §Sprint NNN, (3) every question you cannot answer from the pack. Do not write code. Wait for me.
```

### P2 — Slice into tickets

```text
/to-tickets planning/sprints/NNN-<slug>/requirements.md

Sprint label: sprint:NNN. Tracer-bullet vertical slices only; each ticket must be demoable and fit one fresh context window. Prefactoring tickets first. Every ticket's acceptance criteria must map to at least one line of planning/sprints/NNN-<slug>/acceptance.md; quote the line. Blocking edges as native GitHub relationships. Show me the numbered breakdown and wait for my approval before publishing.
```

### P3 — Implement the frontier (repeat until no ticket is open)

```text
/implement Work the frontier of GitHub issues labelled sprint:NNN and ready-for-agent, in dependency order, one ticket at a time. For each ticket: assign it to me, use /tdd only at the seams agreed in planning/PROMPTS.md §Sprint NNN, red then green with the failing and passing output pasted, typecheck after every green, one commit per ticket in Conventional Commits form ending with "(#<issue>)", then close the issue with a comment containing the test command and output. Stop and ask me if a ticket needs a decision that is not in planning/DECISIONS.md or CONTEXT.md. Never replace MeTTa reasoning with a matcher; never let the LLM set status or receive facts. After the last ticket, run the full suite once and report.
```

### P4 — Review the branch

```text
/code-review master

Spec sources: planning/sprints/NNN-<slug>/requirements.md, acceptance.md and the closed sprint:NNN issues. Standards sources: AGENTS.md §Non-negotiables and §Conventions, CONTEXT.md, docs/adr/. Fix every hard violation and every Spec finding now, each in its own commit referencing the issue; list the judgement-call smells you chose not to fix and why.
```

### P5 — Acceptance evidence and PR

```text
Use the verification-before-completion skill. Run every command in planning/sprints/NNN-<slug>/acceptance.md from a clean checkout of this branch and paste the real output under each line, ✅ or ❌. Do not mark a line ✅ without output. Update planning/STATE.md (current sprint, what shipped, what did not, blockers, next). Push the branch and open one pull request titled "Sprint NNN: <name>" against master whose body follows planning/AUTOMATION.md §Completion report (all eight items). Keep it a draft if any must-line is ❌. Give me the PR URL.
```

### Architect review (paste into the Architect session, not the Builder)

```text
Builder Review for Sprint NNN: read PR <url> on branch sprint/NNN-<slug>, re-run every acceptance.md command from the PR head, compare with the completion report, and give the verdict DONE / DONE_WITH_FOLLOW_UPS / NOT_DONE with the failing lines quoted. Then finalise planning/sprints/<next>/blueprint.md and handoff-prompt.md and update STATE.md.
```

### Resume (if a Builder session dies mid-sprint)

```text
Resume Sprint NNN on branch sprint/NNN-<slug>. Read AGENTS.md, CONTEXT.md, planning/STATE.md, planning/sprints/NNN-<slug>/acceptance.md, then `git log origin/master..HEAD --oneline` and the open sprint:NNN issues. Tell me which tickets are closed, which is in progress and its last green test, and what is next. Then continue with P3.
```

---

## Sprint-specific lines

Append these to P1 and P3 for the sprint. Seams are fixed by D-19; `tdd` writes tests nowhere else.

### Sprint 000 — MeTTa spike (Tue 22 Sep 18:00 → Wed 23 Sep 12:00)
Seams: `MettaRouteEngine.eligible_builders / reuse_candidates / partner_candidates / cohort_of / gaps` (real hyperon, no mocks) and HTTP `GET /health`, `POST /internal/query`.
Skills to load first: `fastapi-clean-architecture` (lifespan + settings only), `docker-project-foundations`.
Append to P3:
```text
Time-box: half a day. Python 3.12, uv, hyperon==0.2.10 (verified by the Architect: a two-hop rule runs). Facts and rules are MeTTa files under services/engine/seed/; date overlap may be a Python-grounded atom, the combining rule must be MeTTa. If pytest -m runtime cannot pass through FastAPI inside the box, stop, write the failure into planning/QUESTIONS.md, open the PR as draft. Never a Python matcher.
```

### Sprint 001 — Routing core (Wed 23 Sep 12:00 → Thu 24 Sep 20:00)
Seams: HTTP `POST /api/conversation`, `POST /api/route`, `GET /api/scenarios`; pure function `assemble(tuples, brief) -> VentureRoute`; `LlmAdapter` protocol via a fake adapter; Zod↔Pydantic JSON-Schema parity test.
Skills: `claude-api` for the Anthropic adapter (official SDK, `claude-opus-5`, `output_config.format`, no raw HTTP), `secure-coding` for input validation.
Inherited (D-20 to D-23): engine models live in `app/models/engine.py`; `gaps()` already covers skill/availability/mode/location; the assembler adds team-size and budget only; partner is the candidate of the first selected builder; infeasible returns no IP/cohort/partner; expected scenario outputs are exact in DOMAIN.md.
Inherited (D-24, D-26): display names derive from builder IDs via one presenter helper; day rates come from `day_rates(builder_ids)` and reach the assembler as plain input; `ANTHROPIC_API_KEY` is read from `.env` only and never requested in chat.
Append to P3:
```text
Contracts ticket first: packages/contracts Zod schemas, exported JSON Schema, Pydantic mirror, parity test green before any assembler work. Status is a pure function of gaps and coverage (D-09); the LLM explanation call receives only route.model_dump() and the test asserts no fact atoms and no outside entity in the request. With ANTHROPIC_API_KEY unset the NullAdapter serves every response type. The five DOMAIN.md scenarios are parametrised pytest cases with exact expected teams, totals and gaps.
```

### Sprint 002 — Founder UI (Fri 25 Sep 08:00 → Sat 26 Sep 20:00)
Before P1: complete `planning/sprints/002-founder-ui/operator-checklist.md` §Before Sprint 002 (merge PR #20, reset local master, Stitch batch 1).

Seams (D-19, D-30 to D-34):
- Engine HTTP: CORS preflight on `/api/route`; snapshot equality against `POST /api/route`; placeholder key → `NullAdapter`.
- Pure function: `handoffText(brief, route)` (Vitest).
- Rendered screens through React Testing Library: review chips, status badge, evidence badge, gaps-first ordering.
- Playwright flows against `vite preview` + the engine on `LLM_PROVIDER=null`: scenario → route, gaps first, drawer, budget change, form = chat, PWA.
- No component-internal tests and no snapshot-of-markup tests.

Skills: `stitch-build:react-components` and `stitch-build:shadcn-ui` (convert `design/stitch/batch-1/*` and `batch-2/*`), `ui-styling`, `vercel-react-best-practices`, `vercel-composition-patterns`, `playwright-cli`, `web-design-guidelines` (final audit only).

Append to P1:
```text
Also read planning/sprints/001-routing-core/review.md and D-29 to D-34 in planning/DECISIONS.md. Confirm in your reply that the Sprint 001 engine answers a CORS preflight with 405 today (curl -i -X OPTIONS localhost:8000/api/route -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"), and list which Stitch exports exist under design/stitch/.
```

Append to P2:
```text
Fixed ticket order:
(1) engine prerequisites: CORS_ORIGINS (D-30), export_offline_snapshot.py --check (D-34), placeholder ANTHROPIC_API_KEY → NullAdapter;
(2) apps/web scaffold + .github/workflows/ci.yml, with the engine and web jobs green (D-33);
(3) API client + routing state; (4) intake; (5) review; (6) route result; (7) Why drawer; (8) handoff; (9) PWA + offline; (10) landing; (11) Playwright suite wired into CI.
Tickets 4–10 may run in parallel only after 3 is closed.
```

Append to P3:
```text
Tokens come from the DESIGN.md block in docs/design/stitch-prompts.md as CSS variables. If design/stitch/batch-1 is missing, build from shadcn defaults with those tokens and say so in the report.

Rendering rules:
- The Gaps panel precedes team cards in DOM order (test it with compareDocumentPosition).
- Every seed-derived card shows the Demo data pill.
- The browser never parses MeTTa output. It renders VentureRoute only and imports every type and schema from @venture-route/contracts.
- Next-action buttons follow D-29.
- The Technical view renders ReasoningPath only (D-31); there is no route.debug.
- Handoff text is generated client-side by handoffText(brief, route) and never includes route.summary.

PWA and CI:
- PWA via vite-plugin-pwa, checked by Playwright per D-32. Lighthouse has no PWA audit; do not add @lhci.
- Playwright runs against vite preview with the engine on LLM_PROVIDER=null and CORS_ORIGINS=http://localhost:4173.
- Paste the CI run URL in each ticket's closing comment.
```

Append to P5:
```text
The acceptance evidence must include the green GitHub Actions run URL for the PR head, and the Playwright HTML report as an artifact on that run. Evidence from a Windows machine is supplementary, not a substitute.
```

### Sprint 003 — Marketplace (Sun 27 Sep 08:00 → Mon 28 Sep 20:00)
Seams: HTTP endpoints under `/api/me/*`, `/api/builders/*`, `/api/admin/*`, `/api/webhooks/clerk` against `TEST_DATABASE_URL` (Neon branch or compose `db`) with a fake Clerk JWT signed by a test JWKS; `reproject()` observed through `GET /health` and a route call; Playwright role smoke tests with Clerk test users.
Skills: `neon-postgres` (pooled `DATABASE_URL`, branches, migrations), `fastapi-clean-architecture` (Clerk JWT dependency pattern), `clerk-setup`, `clerk-react-patterns`, `clerk-webhooks`, `clerk-cli` (local webhook forwarding), `clerk-testing`, `docker-compose-patterns` (add the `db` service with a healthcheck).
Append to P3:
```text
SQLModel + Alembic + asyncpg only (D-17); never the Convex skill. Migration 0001 first, with demo_data default true and a check constraint on every table. Role comes from the Clerk JWT publicMetadata claim; require_role on every route; 401/403, never 500. Confirm and reject commit, then call reproject() in the same request. If STATE.md says the scope floor is active, build only read-only profiles from seed data plus the admin queue.
```

### Sprint 004 — Requests and interviews (Tue 29 Sep 08:00 → 22:00)
Seams: HTTP endpoints `/api/requests*`, `/api/me/bids`, `/api/bookings*`, `/api/me/dashboard` against `TEST_DATABASE_URL`; booking state machine as a pure function; Playwright request → bid → booking round-trip.
Skills: `neon-postgres`, `clerk-testing`, `playwright-cli`.
Append to P3:
```text
Bid creation calls the route service's eligibility(brief, builder_id) in-process and returns 403 with the engine's reason when not eligible. Booking transitions proposed → accepted | countered → confirmed, one counter per round per side, 409 on illegal transitions, history appended in the same transaction. If the scope floor is active, ship requests board + gated bids only.
```

### Sprint 005 — Demo hardening and deployment (Wed 30 Sep 08:00 → 20:00, freeze 22:00)
Seams: `docker compose up` end-to-end via Playwright `demo.spec.ts`; deployed `/health` and landing page via HTTP checks; every earlier sprint's acceptance suite on the freeze commit.
Skills: `docker-build-strategies` (multi-stage, non-root, small engine image), `docker-compose-patterns`, `use-railway` and `deploy-to-vercel` **for writing `docs/DEPLOY.md` only** (engine service, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLERK_*`, release command `alembic upgrade head`, health check `/health`; web `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`), `mattpocock-skills:wizard` (turn DEPLOY.md into the step-by-step wizard the Operator runs), `neon-postgres` (production `main` branch, `demo` branch for resets), `playwright-cli` (record the demo video), `secure-coding` (final pass on headers, CORS, secrets).
Append to P3 (deployment is the last two tickets):
```text
No new features. Order: regressions from earlier acceptance suites → single launch command and README → docs/DEMO.md script → Playwright CLI recording of demo.spec.ts to docs/demo/ (D-28) → docs/PITCH.md per-slide script and the Slides-artifact deck rebuilt from the existing pitch PDF with the video on the demo slide, team names as a placeholder → docs/DEPLOY.md wizard (D-27): Railway steps for services/engine (Dockerfile, release command, health check, env vars from .env.example, public domain), Vercel steps for apps/web with VITE_API_URL, Neon main as production DATABASE_URL and demo branch for resets — the Operator runs every railway and vercel command and pastes the URLs and /health 200s back → docs/SUBMISSION.md. Never run railway or vercel yourself. Freeze: tag v0.1.0-demo on the merged commit and write the SHA into STATE.md.
```

---

## Timeline recap (EAT)

| Sprint | Paste P1 at | Gate (Architect review by) |
|---|---|---|
| 000 | Tue 22 Sep 18:00 | Wed 23 Sep 12:00 |
| 001 | Wed 23 Sep 12:00 | Thu 24 Sep 20:00 |
| 002 | Fri 25 Sep 08:00 | Sat 26 Sep 20:00 (scope-floor trigger) |
| 003 | Sun 27 Sep 08:00 | Mon 28 Sep 20:00 |
| 004 | Tue 29 Sep 08:00 | Tue 29 Sep 22:00 |
| 005 | Wed 30 Sep 08:00 | Wed 30 Sep 22:00 freeze |
| Demo | Thu 1 Oct | recording is the fallback |

Stitch batch 1 exports must be committed under `design/stitch/batch-1/` before P1 of Sprint 002.
