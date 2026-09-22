# QUESTIONS — open items (Question / Owner / Needed by / Status)

| # | Question | Owner | Needed by | Status |
|---|---|---|---|---|
| Q-01 | Confirm D-09: status value is deterministic; the LLM explains it. (Operator wording on 2026-09-22 could be read as "LLM decides status".) ADR 0006 records the deterministic reading. | Operator | Sprint 001 start | Open — one-word confirmation requested |
| Q-02 | Anthropic API key available in `.env` for Sprint 001? | Operator | Wed 2026-09-23 | Open |
| Q-03 | Clerk application (publishable + secret keys, webhook signing secret) created? | Operator | Sat 2026-09-26 | Open |
| Q-04 | Neon project created; pooled `DATABASE_URL` for `main` and a `demo` branch known? (Neon MCP is connected in the Architect session and can create it on request.) | Operator | Sat 2026-09-26 | Open |
| Q-05 | Railway project and Vercel project names, or should the Builder create them via CLI in Sprint 005? | Operator | Tue 2026-09-29 | Open |
| Q-06 | Does the hackathon require a public URL at submission, or is laptop + recording enough? | Operator | Sun 2026-09-27 | Open |
| Q-07 | Recording tool for the fallback demo (OBS, Loom, QuickTime)? | Operator | Tue 2026-09-29 | Open |
| Q-08 | Names of any additional team members and their roles (reviewer? designer?). | Operator | Whenever | Open |
| Q-09 | Demo time on 1 Oct and slot length, to size the scenario walkthrough. | Operator | Mon 2026-09-28 | Open |
| Q-10 | Delivery-mode compatibility beyond requirements.md ("hybrid accepts remote and hybrid supporters"): the Sprint 000 Builder read **remote briefs as accepting `remote` and `hybrid` supporters** and on-site as `on-site` plus location; the Operator replied "continue" to that reading on 2026-09-22. Encoded as the `mode-accepts` policy table in `services/engine/seed/rules.metta` and asserted in `tests/test_rules_semantics.py`. Architect to ratify as a DECISIONS entry (or change the table). | Architect | Sprint 001 start | Open — reading in use |
| Q-11 | `route-gap` picks `location` over `mode` for an on-site brief when a verified, available builder supports on-site elsewhere; `mode` otherwise. Implemented with helper equations `verified-and-available`, `verified-available-compatible`, `on-site-elsewhere` in `rules.metta` (not rule names; they decide nothing on their own and are excluded from `rules_loaded`). Architect to confirm the category reading and the helper naming. | Architect | Sprint 001 start | Open — reading in use |
