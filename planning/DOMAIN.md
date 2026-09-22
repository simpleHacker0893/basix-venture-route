# DOMAIN — terms, actors, rules

## Business goal
Give a founder one trustworthy answer: *given my MVP, constraints and budget, what is the smallest credible route through BASIX, and why should I trust it?* Prove, in the UI, that MeTTa graph rules make the decision.

## Actors
| Term | Meaning |
|---|---|
| Founder | Person with a venture brief. Uses routing without an account; signs up to post requests and book interviews. |
| Builder (student) | MeTTa OmniUniversity or BASIX cohort member with a profile, credentials, projects, availability, day rate. |
| BASIX admin | Confirms accounts, credentials and projects. Only confirmed records enter the graph. |
| Judge | MeTTa-track evaluator. Needs named rules, source facts, a multi-hop result, and an honest no-match. |
| Operator | Njuguna Njenga. Approves sprints, merges, demos. |

## Core objects
| Term | Definition |
|---|---|
| Venture brief | Validated founder input: `id, title, vertical, requiredSkills[], maximumTeamSize, availabilityStart, availabilityEnd, deliveryMode, location?, dailyBudget, preferReusableIp`. Contract in `packages/contracts`. |
| Route | Engine output: status, builders with evidence, total day rate, optional reusable IP, cohort, partner, gaps, rules applied, summary. |
| Evidence type | `credential` (a confirmed credential proves the skill), `project` (a confirmed completed project demonstrates it), `both`. |
| Reasoning path | `{ rule, facts[], conclusion }`. One per builder×skill, per IP, per cohort, per partner. |
| Gap | `{ category, statement, affected[], nextActions[] }` with `category ∈ skill, availability, mode, location, team-size, budget`. Each gap names its rule. |
| Self-described skill | A skill the builder claims without proof. Shown on profiles as "Self-described"; never eligible. |
| Demo data | Every record in this release. Shown as an amber pill. |
| Verticals | `health`, `agri`, `education`. |
| Skills (seed) | Nine IDs with display names: `python` Python · `ai-metta` AI / MeTTa · `ui-ux` UI/UX design · `frontend` Frontend · `backend` Backend · `domain-research` Domain research · `mobile` Mobile · `rust` Rust · `data` Data engineering. The seed file repeats these exactly. |

## Graph predicates (facts)
`has-self-described-skill`, `earned (builder credential)`, `proves (credential skill)`, `built (builder project)`, `demonstrates (project skill)`, `belongs-to (builder cohort)`, `cohort-of (cohort university)`, `available (builder start end)`, `supports-mode (builder mode)`, `located-in (builder location)`, `day-rate (builder usd)`, `vertical (asset|project vertical)`, `licensable (asset)`, `supports-vertical (partner vertical)`, `partners-with (partner university)`, `confirmed (admin record)`.

## Named rules (MeTTa)
| Rule | Holds when |
|---|---|
| `verified-for-skill (b s ev)` | `earned b c` ∧ `proves c s` ∧ `confirmed c` → ev=`credential`; or `built b p` ∧ `demonstrates p s` ∧ `confirmed p` → ev=`project`. Both present → `both`. |
| `mode-compatible (b brief)` | `supports-mode b m` for the brief's mode; if mode is `on-site`, also `located-in b loc` equals the brief location. |
| `available-for-brief (b brief)` | `available b s e` overlaps the brief window by ≥ `MIN_OVERLAP_DAYS` (2). |
| `eligible-builder (brief b s ev)` | `verified-for-skill` ∧ `mode-compatible` ∧ `available-for-brief` ∧ `confirmed` account. |
| `reuse-fit (brief asset)` | `licensable asset` ∧ `vertical asset v` = brief vertical ∧ asset `demonstrates` at least one required skill. Only when `preferReusableIp`. |
| `partner-fit (brief partner)` | `supports-vertical partner v` ∧ `partners-with partner u` ∧ `cohort-of c u` ∧ `belongs-to b c` for a selected builder b. Four hops. |
| `route-gap (brief s category)` | For a required skill s: no `verified-for-skill` → `skill`; verified but none `available-for-brief` → `availability`; verified+available but none `mode-compatible` → `mode` (or `location` when on-site location mismatch). |
| `assembler.team-size-fit`, `assembler.budget-fit` | Python assembler rules (D-09): no covering subset within `maximumTeamSize` → `team-size`; every covering subset exceeds `dailyBudget` → `budget`. |

## Team assembly (deterministic, Python)
1. Collect `(builder, skill, evidence)` tuples from `eligible-builder`.
2. Gap for each required skill with no tuple.
3. Enumerate subsets up to `maximumTeamSize`; keep those covering all satisfiable skills; drop those over budget.
4. Order: fewer people → lower total rate → stronger evidence (`both` > `credential` > `project`) → builder IDs ascending.
5. Status per D-09. Choose IP, cohort (of the first selected builder), partner by stable ordering.

## LLM boundary
Permitted: extract brief fields with a strict schema; ask for missing fields; explain a route or gap from the structured result; restate engine-supplied next actions.
Forbidden: select, rank, reject or substitute entities; infer facts absent from the result; produce a route when the engine reports a gap; mutate facts; receive raw graph data.
System instruction (verbatim, must appear in code): *The routing engine is the source of truth for people, credentials, projects, availability, cost, cohorts, partners and gaps. Never select entities, invent evidence, or claim a route is verified unless the exact information appears in the engine result. If the route contains a gap, explain that gap and only the next actions supplied by the engine.*

## Marketplace rules
- A builder or founder account is invisible in routes, bids and candidate lists until an admin confirms it.
- A bid is allowed only where `eligible-builder` holds for the request's brief and the bidding builder.
- Contact fields are shown to founders only when the builder toggles sharing on.
- Booking states: `proposed → accepted | countered → confirmed`. Either party may counter once per round.

## Demo scenarios (seed IDs in `services/engine/seed/briefs.json`)
| Scenario | Brief | Expected |
|---|---|---|
| Health pilot | python, ai-metta, ui-ux; hybrid; 2026-09-22→2026-09-29; team ≤3; USD 400; reusable IP | `feasible`, 3 builders, health IP asset, cohort, health partner via 4-hop chain |
| Agri marketplace | frontend, backend, domain-research; remote; team ≤3; USD 350 | `feasible`, different team, agri IP, agri partner |
| Constrained brief | mobile, rust; remote; 2026-09-22→2026-10-06; team ≤2; USD 300 | `partial`, `skill` gap for mobile, rust builder shown |
| Budget challenge | Health pilot with USD 250 | `partial`, `budget` gap, or a cheaper covering team only if evidence supports one |
| Delivery-mode challenge | Health pilot, on-site, location "Kisumu" | `partial`, `location` gaps |
