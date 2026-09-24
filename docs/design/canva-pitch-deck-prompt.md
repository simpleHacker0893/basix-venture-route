# Canva prompt — Venture Route pitch deck (12 slides)

Operator decision 2026-09-24 (Q-19): a new 12-slide deck designed in Canva from the planning pack, replacing the Slides rebuild in D-28. Paste the block below into Canva's design generator (or hand it to the Canva MCP). Every figure in it comes from `docs/PRD.md`, `planning/DOMAIN.md` and `planning/STATE.md`; do not let Canva add numbers, logos, customers or quotes that are not here (AGENTS.md rule 10). Team names other than the founder stay blank until the Operator supplies them (Q-08).

```text
Create a 12-slide 16:9 pitch deck titled "Venture Route". Hackathon pitch, BASIX hackathon, SingularityNET MeTTa track, demo day Thursday 1 October 2026.

STYLE
Calm, editorial, trustworthy: a well-set research report, not a SaaS pitch. No gradients, glassmorphism, neon, stock photos, stock illustrations or emoji.
Colours: background #f4f1ea (warm off-white), cards #fbf9f4, text #16181b, secondary text #3f4650, primary accent #1e5a45 (deep green), secondary accent #35418a (indigo), warning/gap accent #8a4b12 on #e8c58f, one dark slide background #16181b with light-green #7fd1ac accents.
Fonts: headlines Fraunces (serif, 500-600); body IBM Plex Sans; rule names, numbers and IDs in IBM Plex Mono.
Hairline borders (#e3ded3), 8 px card corners, pill-shaped chips. Plenty of whitespace, one idea per slide, max 30 words of body text per slide.

SLIDE 1 — Title
"Venture Route". Subtitle: "Evidence-backed venture routing through the BASIX ecosystem, decided by MeTTa graph rules."
Footer: "Founder: Njuguna Njenga" and a second line "Team: ____________" left blank. "BASIX hackathon · SingularityNET MeTTa track · 1 October 2026".

SLIDE 2 — The problem
Headline: "BASIX has the ingredients of a venture, but not the route."
Body: Verified learning, credentials, builders, completed IP, cohorts, universities and partners exist as records, not as a delivery path. A founder today browses profiles, guesses whether a skill is credible, estimates time and budget, finds reusable IP by chance and asks staff for introductions. Slow, hard to audit, unverified.

SLIDE 3 — Who it serves
Four cards: Founder: "a credible, affordable, time-feasible team and a reason to trust it". Builder: "a verified profile, visibility to founders, bids and interviews". BASIX admin: "confirm people and facts, keep the ecosystem honest". MeTTa judge: "proof that MeTTa performs the core reasoning".

SLIDE 4 — The answer
Headline: "One trustworthy answer."
Quote-style line: "Given my MVP, constraints and budget, what is the smallest credible route through BASIX, and why should I trust it?"
Below, the route contents as chips: verified builders · reusable IP · cohort and university · partner · total day rate · named gaps.

SLIDE 5 — How it works
A left-to-right flow of four steps with arrows: 1 "Founder describes the MVP in plain language (chat or form)" → 2 "Founder confirms the structured brief" → 3 "MeTTa rules decide eligibility, evidence, fit and gaps over inspectable facts" → 4 "Route with evidence, or an honest gap; a language model only explains it".

SLIDE 6 — MeTTa is the decision layer (dark slide)
Headline: "Not an AI matcher."
Seven rule names in mono as a list: verified-for-skill, mode-compatible, available-for-brief, eligible-builder, reuse-fit, partner-fit, route-gap.
Side note: "Official Hyperon runtime 0.2.10 in-process · 181 seed facts · 7 rules loaded". Caption: "The language model may translate and explain. It never selects people, invents evidence or sets the route status."

SLIDE 7 — Every answer is inspectable
Headline: "Why this route?"
Show one reasoning path as a mono card: rule "partner-fit", a four-hop chain Builder → Cohort → University → Partner, conclusion "amani-health fits the health brief". Caption: "Every builder, IP asset, cohort and partner carries the rule and the source facts that produced it."

SLIDE 8 — Honest gaps, not fabricated matches
Headline: "When the ecosystem can't deliver, we say so."
Example card, amber accent: Constrained brief asks for Mobile and Rust. Result "Partial": one builder verified for Rust at USD 130 / day; gap "skill: no verified Mobile builder" from route-gap, with next actions. Second small card: Budget challenge, USD 250 against a USD 370 team → gap "Raise daily budget to USD 370".

SLIDE 9 — Five live demo scenarios
A clean table: Health pilot → Feasible, team of 3, USD 370 / day, reusable IP, partner via 4 hops. Agri marketplace → Feasible, team of 3, USD 315 / day. Constrained brief → Partial, Mobile skill gap. Budget challenge → Partial, budget gap. On-site in Kisumu → Infeasible, three location gaps.
Caption: "Change one hard constraint and the route or the gap changes, live."

SLIDE 10 — A marketplace around the route
Headline: "From verified work to real opportunity."
Four steps: BASIX admin confirms accounts, credentials and projects → confirmed records re-project into the MeTTa graph → founders post requests; only builders for whom eligible-builder holds can bid → interviews are proposed, countered and confirmed inside the platform.

SLIDE 11 — Builder Showcase
Headline: "Builders show what they have shipped."
Body: A public Showcase of builders' projects with description, live and demo links, a YouTube pitch and a pitch deck, plus certifications and skill sets. Admin-reviewed before it goes public. Display only: showcase data never changes a routing decision. Contact details are visible only to signed-in founders.

SLIDE 12 — Status, next steps and team
Left column "Built": routing engine, founder app (chat, form, Why this route?, handoff, offline mode), marketplace with Clerk sign-in and Neon Postgres, requests, gated bids and interviews, Showcase.
Left column "Next": voice intake, real BASIX data replacing demo data.
Right column "Team": "Njuguna Njenga, Founder" and three blank lines "____________, ____________".
Bottom row, three labelled blank link placeholders: "Live demo: ________", "Demo video: ________", "Repository: github.com/simpleHacker0893/basix-venture-route".
Small caption on every slide footer: "All people, credentials, projects and partners shown are fictional demo data."
```
