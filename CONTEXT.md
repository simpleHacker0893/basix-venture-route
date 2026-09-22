# Venture Route

Venture Route turns a founder's plain-language venture brief into an evidence-backed route through the BASIX ecosystem. MeTTa graph rules decide who is eligible and why; a language model only translates and explains. This glossary is the project's vocabulary; the rules of the domain live in `planning/DOMAIN.md`.

## Language

### Core objects

**Venture brief**:
A founder's validated request for a team: title, vertical, required skills, maximum team size, availability window, delivery mode, optional location, daily budget, and whether reusable IP is preferred.
_Avoid_: request (that is a marketplace object), prompt, query

**Route**:
The engine's answer to a venture brief: a status, the builders with their evidence, the total day rate, optional reusable IP, cohort, partner, gaps, the rules applied, and a summary.
_Avoid_: match, recommendation, result set

**Evidence type**:
How a builder's skill is proven: `credential` (a confirmed credential proves it), `project` (a confirmed completed project demonstrates it), or `both`.

**Reasoning path**:
One record of `{ rule, facts, conclusion }` showing which named rule, over which source facts, produced a conclusion. There is one per builder-and-skill, per reusable IP, per cohort, and per partner.
_Avoid_: explanation (that is the language model's prose), trace

**Gap**:
A reason a brief cannot be fully satisfied: `{ category, statement, affected, nextActions }`, where the category is one of `skill`, `availability`, `mode`, `location`, `team-size`, `budget`. Every gap names the rule that produced it.
_Avoid_: error, missing match

**Self-described skill**:
A skill a builder claims without a confirmed credential or project. Shown on profiles as "Self-described"; never counts as verified and never makes a builder eligible.
_Avoid_: unverified skill, claimed skill

**Demo data**:
The label carried by every record in this release, seed-derived or user-entered, shown in the UI as an amber pill.
_Avoid_: sample data, test data, fixture

### Skills

The nine skill IDs are stable kebab-case slugs: `python`, `ai-metta`, `ui-ux`, `frontend`, `backend`, `domain-research`, `mobile`, `rust`, `data`. Never rename a skill ID. Display names belong to the seed file, not to this glossary.

### MeTTa rules

These seven names identify the rules that make every eligibility, evidence, fit and gap decision. Do not invent new rule names without a `planning/DECISIONS.md` entry.

**verified-for-skill**:
A builder holds a skill because a confirmed credential proves it, a confirmed completed project demonstrates it, or both.

**mode-compatible**:
A builder supports the brief's delivery mode and, when the mode is on-site, is located where the brief says.

**available-for-brief**:
A builder's availability window overlaps the brief's window by at least the minimum overlap.

**eligible-builder**:
A builder who is verified for a required skill, mode-compatible, available for the brief, and has a confirmed account.

**reuse-fit**:
A licensable asset in the brief's vertical that demonstrates at least one required skill. Considered only when the brief prefers reusable IP.

**partner-fit**:
A partner that supports the brief's vertical and partners with the university whose cohort a selected builder belongs to. A four-hop chain.

**route-gap**:
For a required skill, the reason no builder qualifies: no verified builder (`skill`), verified but none available (`availability`), verified and available but none mode-compatible (`mode`, or `location` for an on-site mismatch).

### Assembler rules

Two named rules belong to the deterministic Python assembler rather than to MeTTa.

**assembler.team-size-fit**:
No subset of eligible builders within the maximum team size covers every satisfiable skill; produces a `team-size` gap.

**assembler.budget-fit**:
Every covering subset exceeds the daily budget; produces a `budget` gap.

### Actors

**Founder**:
A person with a venture brief. Uses routing without an account; signs up to post requests and book interviews.
_Avoid_: user, customer

**Builder**:
A MeTTa OmniUniversity or BASIX cohort member with a profile, credentials, projects, availability, and a day rate.
_Avoid_: student (on its own), developer, candidate

**BASIX admin**:
The person who confirms accounts, credentials and projects. Only confirmed records enter the graph.

**Judge**:
A MeTTa-track evaluator who needs named rules, source facts, a multi-hop result, and an honest no-match.

**Operator**:
The person who approves sprints, merges, and demos.
