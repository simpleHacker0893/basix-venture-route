# Sprint 005a (Showcase and Chloe) and folded Sprint 006 — close-out review

**Spec:** #86 · **Merged PRs:** #112, #113, #114, #115 (the four 005a parts), then the close-out PRs #117 (engine format), #118 (#109 showcase e2e), #119 (#77 CI Clerk JWKS), #120 (#82 Health eligibility), #121 (#116 Chloe phrases, Q-14) · **Head reviewed:** `master` at `e712d35` · **Date:** 2026-09-29 · **Reviewer:** Builder close-out session (Operator authorised the merges and issue closes)

## Verdict: DONE with listed exceptions

Every Must line of Part A and of Sprint 006 has evidence at `e712d35`. Exceptions, none of them a Must:

1. 006 Should 1 (real-key Chrome voice run) is Operator-manual and not yet done.
2. 006 Should 2 is partial: the consent caption is proven in Playwright, but the speaking indicator and "Stop Chloe" are proven in RTL only (`?voiceHold=1` was never built).
3. 006 Should 3 (`web-design-guidelines` audit at 1440 and 1024 px): no audit record found in the PRs or planning files; treat as not done.
4. Two Must clauses were open when this close-out started and are closed by this PR: `docs/API.md` had no voice-client sentence (006 Must 11; added here) and `STATE.md` was stale (005a Must 14, 006 Must 11; rewritten here).
5. Stitch batch-6 exports never landed (Q-17); the Showcase pages use the composed fallback the requirements allowed.

Part B (demo hardening) is out of scope for this review and entirely open.

## Re-run evidence

Local (compose `db`, Postgres 18.6, scratch database `venture_route_test86`, asyncpg URL exported in the shell; log `closeout-005a-plan/t6-logs/alembic2.log`):
```
$ uv run alembic upgrade head            -> 0001 -> 0002 -> 0003 (head), exit 0
$ uv run alembic downgrade -1            -> exit 0, alembic current: 0002
$ uv run alembic upgrade head            -> exit 0, alembic current: 0003 (head)
$ psql: select version_num from alembic_version -> 0003
$ psql: projects columns like 'showcase%' -> showcase_confirmed_at, showcased, showcase_status
$ psql: show server_version              -> 18.6 (Debian 18.6-1.pgdg13+2)
```
D-51 command (006 Must 1), run in the worktree at `docs/005a-closeout`:
```
$ git diff --stat 277ff15 HEAD -- packages/contracts/src/chat.ts services/engine/app/models services/engine/app/conversation services/engine/seed/rules.metta services/engine/seed/facts.metta services/engine/seed/briefs.json
(no output)         # 277ff15 = 005a branch point; also empty against 53b265d (master before #112)
```
CI job "Chloe conversation contract unchanged (D-51)" is skipped on master by design (`if: github.ref != 'refs/heads/master'`); it runs on this PR and on the 005a-style PRs.

CI, master run 36622550686 at `e712d35` (conclusion success; web and engine jobs green; log kept at `closeout-005a-plan/t6-logs/ci-36622550686.log`):
```
engine: Run uv run alembic upgrade head            success   (postgres:18 service)
engine: 565 passed, 30 warnings in 206.81s (0:03:26)
engine: All checks passed!   (ruff check)
engine: 118 files already formatted
engine: Success: no issues found in 118 source files   (mypy)
engine: packages/contracts/src/schema.json is up to date
engine: apps/web/src/offline/snapshot.json is up to date
web: pnpm -r build / typecheck / lint / test          success
web: packages/contracts test  Test Files 2 passed (2), Tests 46 passed (46)   (parity test included)
web: apps/web test            Test Files 35 passed (35), Tests 268 passed (268)
web: no-key Playwright        23 passed (37.5s)   (chloe.spec x3, landing x2, offline, pwa x2, scenarios x6, showcase x9)
web: Clerk Playwright suite   21 passed (1.9m)    (blocking; auth x3, marketplace x5, requests x6, showcase x4, sprint4-health-request x3)
```

## Line by line — Sprint 005 Part A (`acceptance.md`)

| # | Line | Status | Evidence | Gap |
|---|---|---|---|---|
| M1 | Alembic upgrade on compose db and CI postgres:18; downgrade -1 then upgrade | ✅ | Local output above; CI "Run uv run alembic upgrade head success" on `postgres:18`; `test_migration_0003.py::test_upgrade_head_adds_the_showcase_columns`, `::test_downgrade_removes_them_and_upgrade_restores_them`, `::test_rows_written_under_0002_keep_their_values` | none |
| M2 | Save → pending; absent until admin confirms; edit → pending and leaves list | ✅ | `test_me_showcase.py::test_saving_showcase_details_on_a_confirmed_project_is_pending`, `::test_an_edit_sends_a_confirmed_entry_back_to_pending`; `test_showcase_public.py::test_absent_until_confirmed_present_after_and_an_edit_takes_it_off` | none |
| M3 | Visibility table (project unconfirmed / rejected / account unconfirmed / showcased false / showcase rejected) hides and 404s | ✅ | `test_showcase_public.py::test_a_hidden_entry_is_absent_and_404_like_a_missing_one` parametrised over `HIDERS` (six cases, superset of the five) | none |
| M4 | URL validation table; YouTube forms → videoId | ✅ | `test_links.py` (http, localhost, IP literal, > 500 chars, non-YouTube `pitchVideoUrl`, `youtu.be`, `watch?v=…&t=30s`, `shorts/`); HTTP seam `test_me_showcase.py::test_invalid_showcase_input_is_422_naming_the_field`, `::test_every_youtube_form_normalises_to_one_url` | none |
| M5 | D-52 display-only facts: five scenarios route deep-equal; typed/suggested skills stay ineligible; hostile labels one atom | ✅ | `test_projection_display_facts.py::test_display_facts_leave_the_five_scenarios_route_equal`, `::test_a_builder_with_only_typed_or_suggested_skills_is_never_eligible`, `::test_a_hostile_label_renders_as_exactly_one_escaped_string_atom`, `::test_escaped_labels_load_as_exactly_one_atom_each`; `test_seed_showcase_demo.py::test_the_seed_leaves_the_five_demo_scenarios_route_equal` | none |
| M6 | Profile `skillSet` stored, `self_described_skills` untouched; `githubUrl`/`linkedinUrl` 422 | ✅ | `test_me_showcase.py::test_profile_saves_skill_set_suggestions_and_links`, `::test_invalid_skill_set_or_links_are_422_naming_the_field` (cap 20, 40 chars, case-insensitive duplicate, host mismatch) | none |
| M7 | Résumé suggest (D-50): null adapter, fake adapter cap and `skillId`, never 5xx, text never logged | ✅ | `test_skill_suggest.py::test_null_adapter_answers_unavailable_with_no_suggestions`, `::test_vocabulary_matches_carry_the_skill_id_and_display_name_and_the_list_is_capped`, `::test_any_adapter_failure_is_unavailable_never_a_5xx_and_never_logs_the_text`, `::test_a_successful_suggestion_never_logs_the_text` | none |
| M8 | Public reads 200 without token; other builder's project 404; no token 401 | ✅ | `test_showcase_public.py::test_both_reads_answer_200_without_a_token_and_ignore_a_bad_one`; `test_me_showcase.py::test_another_builders_project_is_404`, `::test_showcase_edit_needs_a_builder_token` | none |
| M9 | Web: header Showcase, cards + Demo data pill + skill filter, no iframe until Play pitch then nocookie src, `rel="noopener noreferrer"` | ✅ | RTL `showcase-groundwork.test.tsx` (header link), `showcase-gallery.test.tsx`, `showcase-detail.test.tsx::loads no iframe until Play pitch is clicked…`, `::gives every external link rel=noopener noreferrer…`; no-key Playwright `showcase.spec.ts` (9 tests, CI 23 passed) | none |
| M10 | Admin confirm/reject/reverse of kind `showcase` write a `confirmations` row, return `projectedRows`; non-admin 403; withdrawn 409 | ✅ | `test_admin_showcase.py::test_confirm_publishes_the_entry_and_reject_takes_it_down`, `::test_reversing_a_showcase_decision_from_the_decided_view`, `::test_showcase_decisions_are_admin_only`, `::test_a_project_never_showcased_is_409_withdrawn`, `::test_an_entry_withdrawn_after_confirmation_is_409`; RTL `admin-showcase.test.tsx` | none |
| M11 | Chloe: every 006 Must passes, contract narrowed per D-51; RTL dashboard read-aloud, booking read-aloud (Nairobi), one toggle state | ✅ | See the 006 table; `chloe-founder.test.tsx::reads the counts and the next interview once on arrival and again on Read aloud`, `::reads the state and the latest proposal in Nairobi time once on arrival and on Read aloud`, `::keeps one voice state across /dashboard, /bookings/:id and /route, shared with the intake switch` | none |
| M12 | Clerk suite: builder adds entry → admin confirms in Showcase tab → signed-out visitor sees it | ✅ | `e2e/clerk/showcase.spec.ts` (4 tests); CI Clerk step "21 passed (1.9m)", blocking | none |
| M13 | Zod mirrors and parity test green | ✅ | `packages/contracts/test/schema-parity.test.ts` ("exports every contract the engine exports, and nothing else"); CI "Test Files 2 passed, Tests 46 passed"; `export_schema.py --check` "schema.json is up to date" | none |
| M14 | pytest, ruff, mypy, typecheck, lint, test green; CI green on PR head; STATE.md updated | ✅ | CI run 36622550686 (summaries above); STATE.md rewritten by this PR. Part A shipped as four PRs (#112 to #115) rather than one; each was CI-green when merged, and master is green at `e712d35` | none |
| S1 | Skill picker: nine vocabulary skills, free text, case-insensitive duplicates | ✅ | `profile.test.tsx::suggests the nine vocabulary skills, accepts free text, and ignores a case-insensitive duplicate (acceptance §Part A Should 1)` | none |
| S2 | `/admin` can reverse a confirm or reject (#49), incl. showcase rows | ✅ | `admin-decided.test.tsx`, `test_admin_decided.py`, `test_admin_showcase.py::test_reversing_a_showcase_decision_from_the_decided_view`, `admin-showcase.test.tsx::lists a decided showcase row and reverses it` | none |

Counts, Part A: Must 14 ✅, 0 ❌, 0 ⚠️, 0 ⏭. Should 2 ✅.

## Line by line — Sprint 006 (`acceptance.md`)

| # | Line | Status | Evidence | Gap |
|---|---|---|---|---|
| M1 | Conversation contract unchanged (narrowed by D-51): `git diff --stat` prints nothing | ✅ | Local command above prints nothing against `277ff15` and `53b265d` | CI job skipped on master by design; it runs on PRs |
| M2 | Greeting spoken once per session; one `chloe-turn` | ✅ | `chloe.test.tsx::speaks the greeting once per session inside the toggle click, and one chloe-turn renders` | none |
| M3 | Vague message: full clarification list in thread, one spoken line (`title`) | ✅ | `chloe.test.tsx::asks only the first missing field while the thread shows the engine's full clarification list` | none |
| M4 | Health read-back, "yes" posts the seed brief with no founder turn, "not yet" posts nothing | ✅ | `chloe.test.tsx::reads the Health pilot back, and a spoken yes posts the seed brief with no founder turn`, `::a spoken 'not yet' after the read-back holds and posts nothing`; `confirm.test.ts` (20 tests, Q-14 phrases from #121) | none |
| M5 | Constrained brief spoken lines in order | ✅ | `chloe.test.tsx::speaks a Constrained route: status, the summary verbatim, the gap and both next actions in order` | none |
| M6 | Keyless fallback announced once, then dictation | ✅ | `chloe.test.tsx::announces a keyless engine once, then the mic is dictation only` | none |
| M7 | jsdom Web Speech: switch disabled, caption, no mic; offline or `voice: null` no switch | ✅ | `chloe.test.tsx::an unsupported browser disables the switch, shows the caption, and hides the mic (Sprint 006 acceptance Must 7)`, `::with no voice provider the switch is absent (…Must 7)`; `chloe-founder.test.tsx::is absent in offline mode and with VITE_VOICE_PROVIDER=off` | none |
| M8 | 503, validation-error label, no-speech failure | ✅ | `chloe.test.tsx::speaks the unreachable line once when /api/scenarios answers 503`, `::speaks a validation-error with the field label`, `::a no-speech failure on release shows the mic error line, speaks it, and sends nothing` | none |
| M9 | Playwright: Agri marketplace by voice deep-equals the form path; `spoken()` starts with greeting | ✅ | `e2e/chloe.spec.ts:13`, CI no-key "23 passed" (test 1) | none |
| M10 | Playwright: offline preview has no switch | ✅ | `e2e/chloe.spec.ts:57`, CI test 2 | none |
| M11 | typecheck/lint/test/e2e/engine green locally and in CI; `.env.example` documents `VITE_VOICE_PROVIDER`; `docs/API.md` voice-client sentence; STATE.md | ✅ | CI run 36622550686; `.env.example:100 VITE_VOICE_PROVIDER=web`; the `docs/API.md` sentence and STATE.md are added by this PR | `docs/API.md` sentence was missing until this PR |
| S1 | Manual real-key Chrome voice run recorded in `operator-checklist.md` | ⏭ Operator-manual | Steps are in `planning/sprints/006-chloe-voice/operator-checklist.md` §Manual voice check; no outcome recorded | Operator to run and paste the outcome |
| S2 | Playwright caption; `?voiceHold=1` shows "Chloe is speaking", "Stop Chloe" hides it and empties the queue | ⚠️ partial | Caption: `e2e/chloe.spec.ts:64` (CI test 3). Indicator and Stop: RTL `chloe.test.tsx::'Stop Chloe' hides the speaking indicator and empties the queue (…Should 2)`, `chloe-founder.test.tsx::shows Chloe is speaking with Stop Chloe…` | `?voiceHold=1` hook never built; no Playwright test for the indicator |
| S3 | `web-design-guidelines` audit at 1440 and 1024 px | ⚠️ not evidenced | The 005a prompt asked for it over `/showcase`, the detail page and the profile editor; no audit result found in PRs #112 to #115 or the planning files | Run the audit and list findings, or record it as skipped |

Counts, Sprint 006: Must 11 ✅, 0 ❌, 0 ⚠️, 0 ⏭. Should: 0 ✅, 2 ⚠️ (S2, S3), 1 ⏭ (S1).

## Rulings recorded during the close-out (from the ledger)

- Ruling: Q-14 phrases added now (Operator accepted 2026-09-29) — cost if wrong: four words to revert.
- Ruling: controller reviewed the one-blank-line diff instead of a reviewer seat — cost if wrong: none, formatting only.
- Ruling: Operator 2026-09-29 — one branch + one PR per task, shipped by a separate background agent; merge after CI green closes the task. Task 1 ships from fix/engine-ruff-format (cherry-pick e531a58); later task branches rebase on master — cost if wrong: extra PR overhead only.
- Ruling: CI no-key run on the PR is the evidence — cost if wrong: one CI round. (Task 2, full no-key run unverified locally because of port 8000.)
- Ruling: Task 5 (#77) upgraded from verify-and-close to a systematic-debugging task — the CI Clerk step fails at sign-in on every GitHub run seen, so Clerk Musts have no CI evidence — cost if wrong: time spent debugging a flake.
- Ruling: fresh implementer (same tier; failure was environmental, not capability) with exact commands and timeouts. (Task 3, after a DNS outage hung the builder.)
- Ruling: ship #77 before #82 so #82 PR CI proves the Clerk suite incl. the Health spec — cost if wrong: #82 waits ~1h.
- Ruling: #77 removes continue-on-error from the Clerk step (D-49 intent: blocking once root cause fixed) — cost if wrong: a real flake blocks merges; revert one line.
- Ruling: PR CI full web job is the evidence — cost if wrong: one CI round. (Task 4, full Vitest and full lint ran out of memory locally.)

Root cause of #77: the CI Clerk step lacked `CLERK_JWKS_URL`, so the engine answered 401 to every token (trace: `POST /api/me/role` 401, admin/pending 401). The secret was added on 2026-09-29 and PR #119 wired it into the step and removed `continue-on-error`. D-49 is amended.

## Follow-ups (deferred minors from the reviews)

- `clerk/showcase.spec.ts:105-109`: `accounts.count()` without a wait may skip the account confirm.
- `clerk/showcase.spec.ts:126`: `expect` on an already-resolved string, no retry.
- `showcase.spec.ts:313`: the test name undersells its `licensable=true` assertion.
- `sprint4-health-request.spec.ts`: ordering relies on the filename; prefer a numeric prefix or state the tolerance.
- The inlined `routeScenario` 60 s timeout should be a parameter on the shared helper; also investigate the slower routing after confirmations.
- `conftest` should normalise a plain `postgresql://` `DATABASE_URL` (43 psycopg2 errors seen with the repo `.env`).
- Fragile `span.first()` title read in the Health spec; `_user` private import.

## Operator-manual and open items

- 006 Should 1: real-key Chrome voice run, outcome into `planning/sprints/006-chloe-voice/operator-checklist.md` (needs `ANTHROPIC_API_KEY` in `.env`, R-11).
- Stitch batch-6 exports (Q-17) never landed; the composed fallback shipped. Landing them later is a design swap, not a contract change.
- Vercel preview deployment check fails on PRs #119, #120 and #121. It is not a CI job and did not gate any merge; it belongs to Part B (Vercel project setup, `docs/DEPLOY.md`).
- Sprint 005 Part B is untouched: compose demo run, Railway and Vercel URLs, the recording, the two-pass `docs/DEMO.md` walkthrough, #51 (Neon reprojection latency), the freeze and tag `v0.1.0-demo`. #19 (live-key Health run) stays optional.
- New spec in brainstorm: demo people and repository access, to follow Part B planning.
