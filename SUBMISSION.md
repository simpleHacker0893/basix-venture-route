# Submission

Mirrors the BASIX hackathon submission form, one `## <Field name>` section per field. Paste each value as written. `TBD` is the only placeholder token; `uv run python scripts/check_submission.py --final` (run in `services/engine`) fails while it remains in Live demo, Slide deck or Demo video.

## Project title

Venture Route

## Tagline

Venture Route uses MeTTa reasoning to route a founder's MVP brief to verified builders, and shows exactly why.

## Description

Venture Route turns a founder's plain-language MVP brief into the smallest credible team from a BASIX-shaped ecosystem, and shows exactly why each person qualifies. When the ecosystem cannot deliver, it says so and names the gap instead of inventing a team.

**What it does.** A founder describes the venture to Chloe, a voice intake, or fills a form. The brief becomes editable chips, then a route: verified builders, reusable IP, a cohort and a partner, with an hourly cost. Gaps come first. "Why this route?" lists the named rule and the source facts behind every card. Builders sign up, add credentials and projects, and are verified by an admin before they appear in the public Showcase. Founders publish a route as a request, eligible builders bid, and the two connect through an interview booking.

**How it works.** The decisions are made by MeTTa, not by a language model. Hyperon runs in-process inside a FastAPI engine. Seven named rules (verified-for-skill, mode-compatible, available-for-brief, eligible-builder, reuse-fit, partner-fit, route-gap) run over verified facts. A skill counts as verified only when a confirmed credential or project proves it. A deterministic assembler turns rule conclusions into the route, so the same brief always gives the same route. Neon Postgres holds the marketplace records and is projected into the MeTTa graph, so confirming a builder changes what the rules can conclude. Clerk provides sign-in and the founder, builder and admin roles. The web app is React on Vite. A model may only make intake conversational and explain a computed route; it never selects people or sets the route status.

**What is next.** Replace the demo seed with real BASIX data through the existing projection path, harden voice intake, and add richer partner and cohort facts for the rules to reason over. The rule names stay fixed: new facts, not new matchers. All current records are fictional demo data.

## GitHub repository

https://github.com/simpleHacker0893/basix-venture-route

## Live demo

https://basix-venture-route.vercel.app/

## Slide deck

https://canva.link/venture-route

## Track

MeTTa

## Demo video

https://youtu.be/jCPnXxG3vuU
