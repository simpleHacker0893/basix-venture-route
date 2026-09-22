# RISKS

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-01 | Nine days to demo with six sprints | High | High | Scope floor in STATE.md; timeline gates in TIMELINE.md; Sprints 003–004 collapse to read-only profiles + gated bids if G2 slips | Operator |
| R-02 | Hyperon rule evaluation surprises (non-determinism, `match` nesting, performance) | Medium | High | Sprint 000 half-day box; runtime already proven for a 2-hop rule; contract test on every CI run; mentor escalation path | Builder |
| R-03 | LLM obscures MeTTa's role for judges | Medium | High | Form fallback, editable brief, evidence drawer on every route, rule names in mono everywhere, status deterministic (D-09) | Architect |
| R-04 | Marketplace tables and the atomspace drift (a confirmed row not reflected in routes) | Medium | Medium | D-15: `reproject()` runs in-process after every confirmation commit; full rebuild only; acceptance test asserts `facts_loaded` changes | Builder |
| R-05 | Claude sessions cannot push (GitHub App not installed) | Certain today | High | Operator installs app; local Claude Code is the fallback Builder path | Operator |
| R-06 | Stitch exports arrive late or off-system | Low (was Medium) | Medium | All four batches landed Tue 22 Sep under `design/stitch/` (15 screens, HTML + screenshots); Builder still falls back to shadcn defaults with the DESIGN.md tokens if an export proves unusable | Operator |
| R-07 | Synthetic data mistaken for real | Low | High | `demoData: true` on every record; amber pill; fictional names; footer disclaimer | Builder |
| R-08 | Live demo fails (network, key, runtime) | Medium | High | Recorded fallback by Wed 30 Sep 20:00; offline mode flag renders seed routes without LLM | Operator |
| R-09 | No hyperon wheel for Python 3.13 | Certain | Low | Pin 3.12 in `.python-version`, Dockerfile, CI | Builder |
| R-10 | Clerk JWT verification or webhook misconfigured, marketplace unusable on demo | Medium | Medium | Sprint 003 acceptance includes a signed-in smoke test per role; `clerk` CLI local webhook test; `ADMIN_EMAILS` bootstrap | Builder |
