# DOMAIN — terms, actors, rules

## Business goal
Give a founder one trustworthy answer: *given my MVP, constraints and budget, what is the smallest credible route through BASIX, and why should I trust it?* Prove, in the UI, that MeTTa graph rules make the decision.

## Actors
| Term | Meaning |
|---|---|
| Founder | Person with a venture brief. Uses routing without an account; signs up to post requests and book interviews. |
| Builder (student) | MeTTa OmniUniversity or BASIX cohort member with a profile, credentials, projects, availability, hourly rate (whole USD 0–50 an hour; 0 means free). |
| BASIX admin | Confirms accounts, credentials and projects. Only confirmed records enter the graph. |
| Judge | MeTTa-track evaluator. Needs named rules, source facts, a multi-hop result, and an honest no-match. |
| Operator | Njuguna Njenga. Approves sprints, merges, demos. |

## Core objects
| Term | Definition |
|---|---|
| Venture brief | Validated founder input: `id, title, vertical, requiredSkills[], maximumTeamSize, availabilityStart, availabilityEnd, deliveryMode, location?, hourlyBudget, preferReusableIp`. `hourlyBudget` is a whole USD 1–250 an hour for the whole team (D-59). Contract in `packages/contracts`. |
| Route | Engine output: status, builders with evidence, total hourly rate, optional reusable IP, cohort, partner, gaps, rules applied, summary. |
| Evidence type | `credential` (a confirmed credential proves the skill), `project` (a confirmed completed project demonstrates it), `both`. |
| Showcase entry | A builder's project with display details (description, live URL, demo URL, YouTube pitch, pitch deck) switched on for the public **Showcase** tab. Public only after a BASIX admin confirms both the project and its showcase details (D-43). Display-only: never a MeTTa fact. |
| Certification | A credential a builder lists with issuer, issue date and verification link. With a vocabulary skill it is a normal credential (confirmed → `proves`); without one it is display-only (D-43). |
| Skill set | The builder's self-described skills picked on the profile. Display-only (AGENTS.md rule 4); shown under "Self-described", never as verified. |
| Reasoning path | `{ rule, facts[], conclusion }`. One per builder×skill, per IP, per cohort, per partner. |
| Gap | `{ category, statement, affected[], nextActions[] }` with `category ∈ skill, availability, mode, location, team-size, budget`. Each gap names its rule. |
| Self-described skill | A skill the builder claims without proof. Shown on profiles as "Self-described"; never eligible. |
| Demo data | Every record in this release. Shown as an amber pill. |
| Verticals | `health`, `agri`, `education`. |
| Skills (seed) | Nine IDs with display names: `python` Python · `ai-metta` AI / MeTTa · `ui-ux` UI/UX design · `frontend` Frontend · `backend` Backend · `domain-research` Domain research · `mobile` Mobile · `rust` Rust · `data` Data engineering. The seed file repeats these exactly. |

## Graph predicates (facts)
`has-self-described-skill`, `earned (builder credential)`, `proves (credential skill)`, `built (builder project)`, `demonstrates (project skill)`, `belongs-to (builder cohort)`, `cohort-of (cohort university)`, `available (builder start end)`, `supports-mode (builder mode)`, `located-in (builder location)`, `hourly-rate (builder usd)`, `vertical (asset|project vertical)`, `licensable (asset)`, `supports-vertical (partner vertical)`, `partners-with (partner university)`, `confirmed (admin record)`.

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
| `assembler.team-size-fit`, `assembler.budget-fit` | Python assembler rules (D-09): no covering subset within `maximumTeamSize` → `team-size`; every covering subset's summed `hourly-rate` exceeds `hourlyBudget` → `budget` (a sum equal to the budget fits; D-59). |

## Team assembly (deterministic, Python)
1. Collect `(builder, skill, evidence)` tuples from `eligible-builder`.
2. Gap for each required skill with no tuple.
3. Enumerate subsets up to `maximumTeamSize`; keep those covering all satisfiable skills; drop those whose summed hourly rate is over the hourly budget.
4. Order: fewer people → lower total hourly rate → stronger evidence (`both` > `credential` > `project`) → builder IDs ascending.
5. Status per D-09. Choose IP, cohort (of the first selected builder), partner by stable ordering.

## LLM boundary
Permitted: extract brief fields with a strict schema; ask for missing fields; explain a route or gap from the structured result; restate engine-supplied next actions.
Forbidden: select, rank, reject or substitute entities; infer facts absent from the result; produce a route when the engine reports a gap; mutate facts; receive raw graph data.
System instruction (verbatim, must appear in code): *The routing engine is the source of truth for people, credentials, projects, availability, cost, cohorts, partners and gaps. Never select entities, invent evidence, or claim a route is verified unless the exact information appears in the engine result. If the route contains a gap, explain that gap and only the next actions supplied by the engine.*

## Marketplace rules
- A builder or founder account is invisible in routes, bids and candidate lists until an admin confirms it.
- A bid is allowed only where `eligible-builder` holds for the request's brief and the bidding builder.
- Every price is per hour (D-59): a profile's `hourlyRate` and a bid's `hourlyRate` are whole USD 0–50; a request's `hourlyBudget` is whole USD 1–250 for the whole team. Out-of-range values are a 422 naming the field.
- Contact fields are shown to founders only when the builder toggles sharing on.
- Booking states: `proposed → accepted | countered → confirmed`. Either party may counter once per round.

## Demo scenarios (seed IDs in `services/engine/seed/briefs.json`)
| Scenario | Brief | Expected |
|---|---|---|
| Health pilot `brief-health-01` | python, ai-metta, ui-ux; hybrid; 2026-09-22→2026-09-29; team ≤3; USD 50 an hour; reusable IP | `feasible`; team amina-otieno (python, both, 15), daniel-kiptoo (ai-metta, both, 19), grace-wambui (ui-ux, credential, 13); total USD 47 an hour; IP `asset-afya-triage`; partner `amani-health` via 4-hop chain |
| Agri marketplace `brief-agri-01` | frontend, backend, domain-research; remote; team ≤3; USD 44 an hour | `feasible`; team wanjiru-mwangi (frontend, credential, 18), lucy-achieng (backend, project, 12), fatuma-hassan (domain-research, credential, 10); total USD 40 an hour (lucy-achieng, 12, beats brian-odhiambo, 15, on cost); IP `asset-shamba-records`; partner `shamba-agri` |
| Constrained brief `brief-constrained-01` | mobile, rust; remote; 2026-09-22→2026-10-06; team ≤2; USD 38 an hour | `partial`; gap `skill` for mobile (`route-gap`); zawadi-njoroge (rust, credential), total USD 16 an hour; no IP, no partner |
| Budget challenge `brief-budget-01` | Health pilot with USD 31 an hour | `partial`; `builders: []`; one `budget` gap (`assembler.budget-fit`): "Cheapest verified team costs USD 47 an hour; budget is USD 31 an hour" and "Raise the hourly budget to USD 47" (D-22) |
| Delivery-mode challenge `brief-onsite-01` | Health pilot, on-site, location "Kisumu"; USD 50 an hour | `infeasible`; three `location` gaps (`route-gap`), no builders, no IP, no partner (D-23) |
