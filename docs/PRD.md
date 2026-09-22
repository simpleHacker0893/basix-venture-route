---
title: "Venture Route — Product Requirements Document"
subtitle: "Product design, architecture, user stories and tech stack"
author: "Owner: Njuguna Njenga (Cpt. N) · BASIX hackathon, SingularityNET MeTTa track"
date: "Version 1.0 · 22 September 2026"
---

# 1. Overview

## 1.1 Product summary

Venture Route is a founder-facing web application that turns a natural-language venture brief into an evidence-backed route through the BASIX ecosystem: the smallest credible team of verified builders, a reusable IP asset when one fits, a relevant cohort and university, a relevant partner, the route's total day rate, and an explicit, named gap whenever a hard constraint cannot be met.

The reasoning that decides eligibility and evidence runs in MeTTa over a relationship graph of BASIX-shaped facts. A language model translates the founder's words into constraints and explains the result; it never selects people, invents proof or claims a route is verified.

Beyond routing, the platform hosts the marketplace around it: founders and students/builders sign in, BASIX admins confirm accounts, students maintain verified profiles and showcase projects, founders post requests, eligible students bid, and interviews are booked inside the platform.

## 1.2 Problem statement

BASIX already holds the ingredients of a venture — verified learning, credentials, builders, completed IP, cohorts, universities and partners — but they exist as records, not as an actionable delivery path. A founder today must browse profiles, guess whether a stated skill is credible, estimate whether a team can meet time and budget, discover reusable IP by chance, and ask BASIX staff for introductions. This is slow, hard to audit, and produces unverified recommendations.

## 1.3 Goals

- Give a founder one concise, trustworthy answer: *"Given my MVP, constraints and budget, what is the smallest credible route through BASIX, and why should I trust it?"*
- Make MeTTa's graph reasoning visible and inspectable in the product: named rules, source facts and at least one multi-hop path per recommendation.
- Report honest gaps instead of fabricated matches.
- Give students and builders a route from verified work to real opportunity.
- Run reliably on a laptop for a live hackathon demo, with a recorded fallback.

## 1.4 Non-goals (this release)

- Live BASIX LMS, credential, marketplace, cohort or partner integrations; real personal data; real IP ownership claims.
- Blockchain minting, wallets, tokenisation, revenue settlement or DICE allocation.
- LLM-based matching, LLM-generated evidence or autonomous tool use.
- Payments, contracting, hiring, CRM, notifications beyond in-app state.
- Multi-route comparison, ranking modes or a mathematically optimal team solver.
- Production observability, tenancy, data governance and privacy compliance.

## 1.5 Success criteria

| Audience | Success looks like |
|---|---|
| Founder | Describes an MVP in plain language, confirms the extracted brief, and receives a route (or a named gap) with evidence in under two minutes. |
| MeTTa-track judge | Sees named rules, source facts and a multi-hop result in the UI; changing a hard constraint changes the route or reveals a gap. |
| BASIX operator | Sees people, credentials, IP, cohorts and partners tied together into a commercially meaningful route; all records labelled as demo data. |
| Student/builder | Has a profile whose skills show as verified only through credential, project or admin confirmation, and can bid on requests the rules say they are eligible for. |
| Team | One documented local launch command; deterministic demo scenarios; a passing real-runtime adapter contract test. |

# 2. Users and personas

| Persona | Role | Primary need |
|---|---|---|
| Founder / entrepreneur | Brings a real product brief | A credible, affordable, time-feasible delivery route and a reason to trust it |
| Student / builder | MeTTa OmniUniversity or BASIX cohort member | A verified profile, showcase projects, visibility to founders, bids and interviews |
| BASIX admin | Ecosystem operator | Confirm students and founders, approve graph facts, keep the demo honest |
| MeTTa-track judge | Evaluator | Proof that MeTTa performs the core reasoning |
| Developer (future BASIX product team) | Maintainer | Stable contracts that let real data replace demo data without redesign |

# 3. User stories

## 3.1 Founder — routing

- As a founder, I want to describe my MVP in my own words so that I do not need to learn BASIX's data model first.
- As a founder, I want Venture Route to identify missing constraints (skills, vertical, team size, dates, delivery mode, location, budget, IP preference) so that the route is feasible rather than generic.
- As a founder, I want to review and correct the structured brief before matching so that a misunderstood skill, date or budget does not produce a wrong route.
- As a founder, I want the smallest team that covers my required skills within my team-size ceiling and daily budget.
- As a founder, I want to see each selected builder's evidence — credential, project or both — so that I can distinguish verified capability from self-description.
- As a founder, I want a reusable IP asset surfaced when one fits my vertical and skills, so that I can shorten time to market.
- As a founder, I want the route's total day rate so that I can confirm it fits my budget.
- As a founder, I want a clear, named gap when no team can satisfy a constraint, with only approved next actions, so that I can decide what to change.
- As a founder, I want to inspect the multi-hop reasoning path for any recommendation so that I can audit why it was included.
- As a founder, I want to export a plain-text venture handoff so that I can share the route with a co-founder, mentor or BASIX operator.

## 3.2 Founder — marketplace

- As a founder, I want to sign up and sign in so that my briefs, requests and bookings persist.
- As a founder, I want to view verified builder profiles from MeTTa OmniUniversity and BASIX so that I can evaluate candidates beyond the route.
- As a founder, I want to publish a request so that eligible students can bid on it.
- As a founder, I want to book an interview with a builder inside the platform so that the route turns into a conversation.

## 3.3 Student / builder

- As a student, I want to create and update my profile so that founders see my current skills and availability.
- As a student, I want my skills to show as verified only when a credential or a completed project proves them and an admin has confirmed it, so that my profile is trusted.
- As a student, I want to add showcase projects with the skills they demonstrate so that they become facts the graph can reason over.
- As a student, I want to see founder requests and bid on the ones where I am eligible so that I can join real projects.
- As a student, I want to choose which contact details to share so that I stay in control of my information.
- As a student, I want to accept or propose interview times so that booking happens in one place.

## 3.4 BASIX admin

- As an admin, I want a queue of pending student and founder accounts to confirm so that only vetted people appear in routes and bids.
- As an admin, I want to confirm credentials and projects as valid proof so that "verified" means something specific.
- As an admin, I want every prototype record labelled as demo data so that the hackathon does not misrepresent real availability, credentials or IP ownership.

## 3.5 Judge and developer

- As a MeTTa-track judge, I want to see named rules, source facts and a multi-hop result in the UI, and an honest no-match state.
- As a backend developer, I want a single narrow MeTTa adapter so that runtime specifics never leak into routing, conversation or UI code.
- As a frontend developer, I want a stable structured route response with evidence paths and gaps so that the UI never parses raw MeTTa output.
- As a reviewer, I want a real-runtime integration test so that the graph engine cannot be silently replaced by a hardcoded matcher.

# 4. Product design

## 4.1 Design principles

1. **Founder-friendly first, MeTTa decision layer second, inspectable evidence third.** The information hierarchy on every screen follows this order.
2. **Evidence, not vibes.** Every recommendation card carries an evidence badge (Credential / Project / Both) and a "Why this route?" affordance.
3. **Gaps ahead of team cards.** A partial route shows its capability gaps before any builder so a valid card is never mistaken for a feasible route.
4. **Demo data is always labelled.** Every seed-derived record shows a persistent Demo data label.
5. **The LLM is a translator.** The normalised brief is always visible and editable; a structured-form fallback exists for every LLM step.

## 4.2 Visual system

| Element | Decision |
|---|---|
| Ground | Warm off-white `#f4f1ea`; cards `#fbf9f4` / `#ffffff`; dark sections `#16181b` |
| Text | Ink `#16181b`; secondary `#3f4650`; captions `#5c6169` |
| Accent | Deep green `#1e5a45` (primary actions, verified, credential evidence); light green `#7fd1ac` on dark |
| Semantic | Indigo `#35418a` project evidence; amber `#8a4b12` / `#e8c58f` Demo data label and gap states |
| Type | Fraunces (display), IBM Plex Sans (body), IBM Plex Mono (evidence paths, rates, rule names) |
| Density | Desktop-first at 1440 px; responsive down to tablet; PWA installable |
| Components | shadcn/ui primitives styled to the tokens above; Stitch output converted to React components by Claude Code |

## 4.3 Screen inventory

| # | Screen | Purpose | Key elements |
|---|---|---|---|
| 1 | Landing page | Explain and convert | Hero with route screenshot, How it works, Evidence, For builders, CTA, footer (approved) |
| 2 | Sign up / sign in | Auth | Clerk prebuilt components; role selection (founder / student) |
| 3 | Founder chat & intake | Capture the brief | Chat input, clarification prompts, structured-form fallback, preloaded scenarios |
| 4 | Brief review | Confirm constraints | Editable chips: vertical, skills, team ≤ N, dates, mode, location, budget, IP preference; "Find my route" |
| 5 | Route result | The answer | Status badge (Feasible / Partial / Infeasible), Gaps panel first when partial, Team cards with evidence badges, IP / Cohort / Partner cards, total day rate vs budget, Demo data label |
| 6 | Why this route? drawer | Audit | Ordered source facts, named rule, evidence type; Technical view with raw query/rule expression |
| 7 | Venture handoff | Share | Plain-text export; copy / download |
| 8 | Student profile | Presence | Skills with verification state, availability interval, day rate, delivery modes, location, contact sharing controls |
| 9 | Add / edit project | Proof | Title, vertical, skills demonstrated, licensable flag, links |
| 10 | Requests board | Opportunity | Open founder requests; eligibility indicator per request; bid action |
| 11 | Founder dashboard | Manage | Briefs, routes, requests, bids received, bookings |
| 12 | Candidate profile (founder view) | Evaluate | Verified skills, projects, evidence, book-interview action |
| 13 | Interview booking | Convert | Proposed slots, accept / counter, confirmation |
| 14 | Admin queue | Trust | Pending students and founders; pending credential/project confirmations; confirm / reject |

## 4.4 Core flow

1. Founder describes the MVP (chat or form).
2. Extractor returns a partial brief; the conversation API returns a clarification until all required fields are present and valid.
3. Founder reviews editable chips; the latest explicit correction wins.
4. Founder submits the confirmed brief; the route service asks MeTTa for eligible builders, IP, partners and cohort context.
5. The deterministic assembler selects the team and computes feasibility status.
6. The route screen renders gaps (if any), team, IP, cohort, partner, cost and evidence; the LLM phrases a summary from the structured result only.
7. Founder opens "Why this route?", changes a constraint, or exports the handoff.

# 5. Architecture

## 5.1 System context

```
React PWA (Vercel)
  → typed conversation API  (FastAPI, Docker Compose / VPS)
      → conversation orchestrator
          → LLM intake / explanation adapter   (structured output, server-side key)
          → brief validation                   (Pydantic; mirrored by Zod on the client)
          → route service
              → MettaRouteEngine adapter  → hyperon runtime + facts + rules (in-process)
              → deterministic team assembler
          → safe response presenter
  → marketplace API (FastAPI) → Postgres (Neon)
  → Clerk (auth, roles)
```

The browser never calls MeTTa directly, never parses raw MeTTa output and never holds LLM credentials. The FastAPI service loads the atomspace once at start-up.

## 5.2 Main behavioural seam: the conversation endpoint

`POST /api/conversation` accepts one founder message plus an optional current partial brief and returns exactly one of three outcomes. This is the primary end-to-end test seam.

```ts
type ChatTurn = { userMessage: string; currentBrief?: Partial<VentureBrief> };

type ChatResponse =
  | { type: "clarification"; missingFields: (keyof VentureBrief)[]; message: string;
      partialBrief: Partial<VentureBrief> }
  | { type: "route"; brief: VentureBrief; route: VentureRoute; message: string }
  | { type: "validation-error"; message: string };
```

## 5.3 Venture brief contract

```ts
type VentureBrief = {
  id: string; title: string;
  vertical: "health" | "agri" | "education";
  requiredSkills: SkillId[];              // non-empty
  maximumTeamSize: number;                // small positive integer
  availabilityStart: string;              // ISO date, date-only semantics
  availabilityEnd: string;                // ISO date, Africa/Nairobi for the demo
  deliveryMode: "remote" | "hybrid" | "on-site";
  location?: string;                      // required when on-site
  dailyBudget: number;                    // positive, one demo currency
  preferReusableIp: boolean;
};
```

Availability overlap: a builder interval `[bStart, bEnd]` qualifies when `bStart <= brief.availabilityEnd && bEnd >= brief.availabilityStart`, subject to a minimum-overlap-days constant to be decided (Open question 1).

## 5.4 Route result contract

```ts
type RouteStatus = "feasible" | "partial" | "infeasible";
type EvidenceType = "credential" | "project" | "both";

type VentureRoute = {
  status: RouteStatus;
  builders: { builderId: string; name: string; dayRate: number;
              covers: SkillId[]; evidenceType: EvidenceType;
              evidencePaths: ReasoningPath[] }[];
  totalDailyRate: number;
  reusableIp?: { assetId: string; title: string; path: ReasoningPath };
  cohort?: { cohortId: string; universityId: string; path: ReasoningPath };
  partner?: { partnerId: string; path: ReasoningPath };
  gaps: { category: "skill" | "availability" | "mode" | "location" | "team-size" | "budget";
          statement: string; affected: string[]; nextActions: string[] }[];
  rulesApplied: string[];
  summary: string;
};

type ReasoningPath = { rule: string; facts: string[]; conclusion: string };
```

## 5.5 Graph domain model (demo data)

Approximate seed sizes: 12–16 builders, 7–9 skills, 8–12 credentials, 5 IP assets (licensable and not), 3 cohorts/universities, 4 partners, 3 briefs with expected outcomes.

Predicates: `has-self-described-skill`, `earned`, `proves`, `built`, `demonstrates`, `belongs-to`, `cohort-of`, `available` (interval), `supports-mode`, `located-in`, `day-rate`, `vertical`, `licensable`, `supports-vertical` (partner), `confirmed` (admin → credential/project/account).

Named rules: `verified-for-skill`, `mode-compatible`, `available-for-brief`, `eligible-builder`, `reuse-fit`, `partner-fit`, `route-gap`. A self-described skill is display-only and never proof.

## 5.6 Deterministic route assembly

1. Request eligible (builder, skill, evidence) tuples from MeTTa.
2. Create a gap for every required skill with no eligible builder.
3. Enumerate eligible subsets up to `maximumTeamSize`; keep subsets covering all satisfiable required skills; reject subsets over `dailyBudget`.
4. Order by team count, then total cost, then evidence strength (both > credential > project), then stable IDs.
5. Status: `feasible` when all skills covered and a subset survives; `partial` when some skills are covered but a hard constraint remains unsatisfied; `infeasible` when no builder is eligible for any required skill.
6. Choose IP, cohort and partner by stable ordering from MeTTa candidate sets.

## 5.7 LLM safety boundary

Permitted: extract brief values with a strict structured-output schema; ask for missing fields; explain a route or gap using only the structured result; restate engine-supplied next actions.

Forbidden: select, rank, reject or substitute any entity; infer any fact absent from the route result; produce a route when the engine reports a gap; mutate facts; receive raw graph data.

System instruction (verbatim): *The routing engine is the source of truth for people, credentials, projects, availability, cost, cohorts, partners and gaps. Never select entities, invent evidence, or claim a route is verified unless the exact information appears in the engine result. If the route contains a gap, explain that gap and only the next actions supplied by the engine.*

## 5.8 Marketplace data and graph projection

Relational tables (Postgres): `users` (Clerk id, role, confirmation state), `profiles`, `skills`, `credentials`, `projects`, `project_skills`, `availability`, `requests`, `bids`, `bookings`, `confirmations`.

Projection: on every confirmed write (profile, project, credential, confirmation), the engine regenerates the affected atoms; on start-up it projects the whole store. User-entered records remain labelled Demo data for this release. Bids are gated: a student can bid only where `eligible-builder` holds for the request's brief.

# 6. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Reasoning | MeTTa via `pip install hyperon` (official Hyperon runtime), pinned version | Track requirement; the official runtime is what judges expect |
| Engine / API | Python 3.12, FastAPI, Pydantic v2 | Same process as the runtime; atomspace loaded once; typed contracts |
| Frontend | React 18 + Vite, TypeScript, Tailwind, shadcn/ui, PWA (installable, desktop-first) | Fast build, matches Stitch's Tailwind output |
| Validation | Zod (client and API edge), Pydantic (server) | Identical brief/route schemas on both sides |
| Auth | Clerk | Sign-up/sign-in, roles via metadata, webhooks to `users` |
| Database | Neon Postgres, SQLModel/SQLAlchemy, Alembic | Marketplace persistence; branchable for demo resets |
| LLM | Provider-agnostic adapter with native structured output; server-side key | Swappable; offline form fallback always available |
| Tests | Vitest, React Testing Library, Playwright; pytest for engine and the real-runtime adapter contract test | Behavioural seams, not implementation details |
| Local run | Docker Compose: `engine` (FastAPI + hyperon), `db` (Postgres), `web` (Vite) | Single `docker compose up`; tests run in the same stack |
| Deploy | Vercel (web); Docker Compose on a VPS or container host (engine + db) | Vercel cannot host the Python runtime |
| Repo | Monorepo: `apps/web`, `services/engine`, `packages/contracts`; Turborepo + uv | Shared schemas; one CI |
| Design | Stitch via Claude Code MCP; Claude Design canvas; Apple-design skill | Consistent screens; Tailwind export to React |
| Method | 120x Architect/Builder Operating Pack; MeTTa spike as Sprint 000 | Spec-first; the handoff is a folder |

# 7. Testing requirements

- **Conversation API:** clarification on vague input; validation errors (invalid mode, non-positive budget, unsupported vertical, on-site without location); Health, Agri, constrained, budget and delivery-mode scenarios; form fallback equals chat for the same brief.
- **Route service:** evidence labelling (credential / project / both); self-described skill never eligible; eligibility requires proof + availability + mode; on-site requires location; selection respects team size and budget with agreed ordering; gaps name the failed constraint; IP and partner keep their paths.
- **MeTTa adapter contract test (real runtime):** loads a fixture, runs a named multi-hop rule, returns typed entity plus evidence; fails if the runtime is unavailable, a rule does not execute, or output cannot be parsed.
- **Schemas:** brief, structured-output and route schemas reject invalid input.
- **Frontend:** submit preloaded brief and see route, gaps, Demo data labels; open Why this route?; change a constraint and see a changed route or gap; form fallback works without LLM.
- **Marketplace:** admin confirmation gates visibility; bids allowed only when eligible; booking round-trip.
- **Manual acceptance:** all demo scenarios from a clean launch; record the fallback only after success.

# 8. Security, privacy and deployment

- No real personal data; all seed records fictional and labelled.
- LLM and database credentials only in server environment configuration; `.env.example` defined by the Operating Pack.
- Clerk-issued sessions; role checks on every marketplace endpoint; admin bootstrap by environment variable.
- Engine exposes only typed endpoints; no raw query endpoint in production.
- Single documented local launch command; recorded backup demo before submission.

# 9. Demo scenarios

| Scenario | Input | Expected outcome |
|---|---|---|
| Health pilot | Python, AI/MeTTa, UI/UX; hybrid; this month; budget; reusable IP preferred | Feasible 2–3 person team, health IP asset, cohort/university, health partner |
| Agri marketplace | Frontend, backend, domain research | Materially different team, IP and partner |
| Constrained brief | Mobile + Rust within two weeks | Partial route with a Mobile capability gap; no fabricated builder |
| Budget challenge | Health pilot budget below the team's day rate | Budget gap, or a lower-cost route only if evidence supports one |
| Delivery-mode challenge | On-site location with no compatible team | Mode/location gap |

# 10. Milestones

| Sprint | Outcome |
|---|---|
| 000 — MeTTa spike | Pinned runtime; fixture; named rule; multi-hop query; typed JSON through FastAPI; abort criterion met |
| 001 — Routing core | Conversation API, brief validation, route service, assembler, adapter contract test, form fallback |
| 002 — Founder UI | Chat/intake, brief review, route result, Why this route?, handoff export, landing page |
| 003 — Marketplace | Clerk auth, profiles, projects, admin queue, DB → graph projection |
| 004 — Requests & interviews | Requests board, gated bids, booking |
| 005 — Demo hardening | Scenarios, recording, Docker Compose, README, submission |

# 11. Risks

| Risk | Mitigation |
|---|---|
| Runtime integration consumes the schedule | Sprint 000 first; escalate to a MeTTa mentor for a minimal example; never replace MeTTa with a TypeScript matcher |
| LLM obscures MeTTa's role | Form fallback, visible brief, evidence drawer on every route |
| Scope (marketplace) crowds out the core | Routing core and evidence UI ship first; marketplace reduced to read-only profiles plus gated bids if time runs short |
| Synthetic data misread as real | Persistent Demo data label; fictional names |
| Local demo fails live | Recorded fallback showing the real runtime; "offline demonstration mode" label in the UI |

# 12. Open questions

1. Minimum overlap days for availability (brief field or global constant).
2. Who owns `partial` vs `infeasible` — the `route-gap` rule or the assembler — so every gap has a named rule.
3. Whether a university → partner edge is modelled; the confirmed headline multi-hop chain.
4. DB → graph projection timing (on write vs on start-up) and how Demo data provenance is preserved for user records.
5. Clerk role source of truth and first-admin bootstrap.
6. Stitch batch one (recommended: intake, brief review, route result, gap state, evidence drawer).
7. Recording tool and boundary for the fallback demo.
8. The pre-agreed scope floor if the adapter is still flaky on Saturday morning.

---

# Errata — decisions taken after v1.0 (22 September 2026)

This document is kept as written. Where `planning/DECISIONS.md` supersedes it, the decision wins:

- **Database:** Convex replaces Neon Postgres, SQLModel and Alembic (D-02). §5.1, §5.8 and §6 rows "Database" and "Local run" read accordingly; there is no `db` container.
- **Deploy:** engine container on Railway (Render fallback), web on Vercel, Convex cloud (D-05).
- **LLM:** Anthropic `claude-opus-5` through the official Python SDK (D-06).
- **Open questions 1–5** are resolved by D-08, D-09, D-07, D-15 and D-03. Question 6 is answered by `docs/design/stitch-prompts.md`. Questions 7 and 8 remain in `planning/QUESTIONS.md` and `planning/TIMELINE.md` (scope-floor trigger at gate G2).
- **Timeline:** demo is Thursday 1 October 2026; see `planning/TIMELINE.md`.
