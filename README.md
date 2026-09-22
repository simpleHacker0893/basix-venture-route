# Venture Route

> Evidence-backed venture routing through the BASIX ecosystem.

**Status:** Hackathon proof of concept — demo data only.

Venture Route helps a founder turn an MVP brief into the smallest credible route through a BASIX-shaped ecosystem: verified labour, reusable IP, cohort and university context, relevant partners, daily cost, and explicit capability gaps.

It is not an AI matcher. A language model may make the intake conversational and explain an already-computed result, but it never decides eligibility, ranks people, or invents evidence. MeTTa relationship rules and inspectable source facts are the authority for recommendations.

## The founder question

> Given my desired MVP, constraints, and budget, what is the smallest credible route through the BASIX ecosystem—and why should I trust it?

## Product principles

- **Evidence-backed routing:** A builder is verified for a requested skill only when a credential proves that skill, a completed project demonstrates it, or both.
- **MeTTa is authoritative:** The graph evaluates eligibility, availability, delivery-mode compatibility, reusable-IP fit, partner fit, and evidence paths.
- **LLM safety boundary:** LLMs extract a candidate founder brief and explain route results only. They cannot select, reject, rank, or substitute entities; invent evidence; or mutate graph data.
- **Honest gaps:** When a hard constraint cannot be met, the product returns an explicit capability gap and supported next actions—never a fabricated match.
- **Demo data only:** All initial builders, credentials, projects, cohorts, universities, and partners are synthetic and visibly labelled **Demo data**.
- **Local-first:** The hackathon MVP runs locally and has a structured-form fallback when LLM or network access is unavailable.

## Founder workflow

1. A founder describes an MVP or completes the structured brief form.
2. The application validates a normalized brief before routing.
3. MeTTa evaluates relationship facts and named rules.
4. Deterministic application logic selects the smallest feasible team within the team-size and total daily-budget limits.
5. The founder receives a route with evidence paths, named rules, cost, optional reusable IP, context, partner, and any capability gaps.

## Architecture

```text
React client
  → typed conversation API
    → conversation orchestrator
      → LLM intake / explanation adapter
      → brief schema validation
      → route service
        → MeTTa route adapter → local MeTTa runtime + facts + rules
        → deterministic bounded team assembler
      → safe response presenter
```

The browser does not invoke MeTTa directly, parse raw MeTTa output, or hold LLM credentials.

### MeTTa decision boundary

The server-side `MettaRouteEngine` is the only module that knows about runtime invocation, query syntax, fact/rule loading, and output parsing. It provides typed results that include entity identifiers, evidence type, named rule, and ordered source facts.

Core rule outcomes:

- verified for skill;
- delivery-mode and location compatibility;
- availability overlap with the founder's requested dates;
- eligible builder;
- reusable-IP fit;
- partner fit;
- route gaps.

## Founder brief

A validated brief includes:

- title and stable ID;
- vertical (`health`, `agri`, or `education` initially);
- required skills;
- maximum team size;
- availability start and end dates;
- delivery mode (`remote`, `hybrid`, or `on-site`) and on-site location when applicable;
- total team daily budget in a single demo currency;
- reusable-IP preference.

Builders qualify for a requested date range when their seeded availability interval overlaps it. A founder can review and edit extracted values before routing; the latest explicit founder correction wins.

## Route result

Each route can include:

- selected builders, covered skills, total daily rate, and credential/project/both evidence labels;
- per-builder × skill evidence paths;
- optional reusable IP asset;
- cohort and university context;
- ecosystem partner;
- named MeTTa rules and source facts;
- partial-route or infeasible status with explicit capability gaps and approved next actions.

Routes are described as the smallest feasible route under the current rules. Team selection uses deterministic exhaustive search within the small configured team-size ceiling, not opaque scoring.

## Demo scenarios

- **Health pilot:** Python, AI/MeTTa, UI/UX; hybrid delivery; reusable health IP preferred.
- **Agri marketplace:** Frontend, backend, and domain/community research with materially different route context.
- **Constrained brief:** Mobile and Rust in a short window; returns an honest mobile capability gap.
- **Budget challenge:** Lower the Health budget below a feasible route's total daily rate.
- **Delivery-mode challenge:** Request an unsupported on-site location and receive a location/mode gap.

## Delivery gates

Before frontend work, the project will demonstrate a real local MeTTa runtime that:

1. starts locally;
2. loads deterministic fixture facts;
3. executes a named rule;
4. returns a parseable multi-hop result; and
5. is invoked from the Node adapter in an integration test.

The adapter emits a fixed sentinel-delimited JSON result and rejects malformed or unexpected protocol output. The MVP must never silently replace MeTTa reasoning with an in-memory TypeScript matcher.

## Planned stack

- React + Vite client
- Node + TypeScript application server
- Zod schemas for brief and route contracts
- Local MeTTa / Hyperon runtime behind a narrow server-side adapter
- Standard TypeScript tests, React Testing Library, and a real-runtime adapter integration test

## Getting started

Implementation is beginning. The repository will document a single local launch command, runtime prerequisites, an environment template, and the offline form-only demo path as they are added.

## References

- [MeTTa language](https://metta-lang.dev/)
- [Hyperon experimental runtime](https://github.com/trueagi-io/hyperon-experimental)
- [MeTTa specification](https://trueagi-io.github.io/hyperon-experimental/metta/)

## License

MIT

---

Built as a BASIX-focused hackathon proof of concept. No real people, availability, credentials, IP ownership, or partner relationships are represented.
