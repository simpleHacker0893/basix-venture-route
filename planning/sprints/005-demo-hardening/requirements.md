# Sprint 005 — Builder Showcase, then demo hardening

**Part A window (Showcase and Chloe, D-51):** Fri 25 Sep 08:00 → Sun 27 Sep 20:00 EAT, gate G5a. **Part B window (hardening):** Mon 28 Sep 08:00 → Wed 30 Sep 20:00 EAT, freeze 22:00 (G5). **Branches:** Part A `sprint/005a-showcase` (PR "Sprint 005a: Showcase and Chloe"); Part B `sprint/005-demo-hardening` (PR "Sprint 005: Demo hardening"), cut from `master` after 005a merges (D-42). **Depends on:** Sprint 004 PR #78 merged (see `planning/STATE.md` §Blockers).

## Goal
Part A: builders show what they have built (title, description, live URL, demo URL, YouTube pitch, pitch deck), their certifications, skill sets (`profiles.skill_set`, optionally suggested from a pasted résumé) and GitHub/LinkedIn links on a public **Showcase** tab in the header; founders and visitors browse it. Chloe, the voice intake (Sprint 006, pulled in by D-51), ships on the same branch with read-aloud on the founder dashboard and booking screens. Part B: a clean-launch demo from one command, a deployed copy run by the Operator (D-27), a recorded demo, a pitch deck and a README a judge can follow.

## Part A — Showcase and Chloe (Operator request, 2026-09-24; D-42, D-43 as amended by D-52, D-50, D-51; spec #86)

One branch, `sprint/005a-showcase`, and one PR, "Sprint 005a: Showcase and Chloe" (D-51). The Showcase lines below belong to this sprint. For Chloe, `planning/sprints/006-chloe-voice/requirements.md` applies in full, plus the read-aloud additions in item 8. Spec #86 holds the approved design.

### User stories
1. As a builder, I want to add showcase details to one of my projects (description, live URL, demo URL, YouTube pitch link, pitch deck link) and switch "Show on Showcase" on, so that founders see what I have shipped.
2. As a builder, I want to add a certification with its issuer, issue date and verification link, even when it doesn't map to one of the nine vocabulary skills, so that my other qualifications show too.
3. As a builder, I want to pick my skill set from a list (the nine vocabulary skills as suggestions, plus anything I type), so that it appears on my profile and my showcase cards under "Self-described". It is saved to `profiles.skill_set`.
4. As a founder or visitor, I want to open **Showcase** from the header, browse the cards (most recently confirmed first), filter by skill, vertical and "Licensable IP", and search by title, so that I can find relevant work. The project page shows the pitch video, the links, and the builder's verified skills, skill set and certifications.
5. As a BASIX admin, I want to approve or reject a showcase entry in a new **Showcase** tab of `/admin` before it becomes public, so that only reviewed entries appear. Any edit sends the entry back for review.
6. As a founder, I want to go from a showcase page to the builder's page (`/builders/:id`, founder-only, existing contact rules), so that I can request an interview through the Sprint 004 flow.
7. As a builder, I want to paste my résumé text and press "Suggest skills", so that I don't have to type every skill by hand (D-50):
   - Claude Haiku 4.5 suggests skills, and I accept or dismiss them one chip at a time;
   - accepted chips join my `skill_set` as self-described;
   - the text is never stored.
8. As a builder, I want to add my GitHub and LinkedIn profile URLs, so that they show as icon links in the Showcase builder panel.
9. As a founder, I want to switch "Voice: Chloe" on once in the founder header, so that Chloe can help me across the founder screens (D-51):
   - on `/route` she walks me through intake, as in the Sprint 006 stories;
   - on `/dashboard` she reads my counts and my next interview;
   - on `/bookings/:id` she reads a booking's state and its latest proposal.

### In scope
1. Alembic `0003_showcase`:
   - `projects`:
     - `description` (text ≤ 1000, default '');
     - `live_url`, `demo_url`, `pitch_video_url`, `pitch_deck_url` (nullable, ≤ 500);
     - `showcased` (bool, default false);
     - `showcase_status` (`none | pending | confirmed | rejected`, default `none`, CHECK);
     - `showcase_confirmed_at` (timestamptz, nullable): the gallery sort key, set on confirm and cleared on any edit or reject;
     - an index on `(showcase_status, showcase_confirmed_at desc)`.
   - `profiles`:
     - **`skill_set` text[]**: default `{}`, at most 20 entries of up to 40 chars, trimmed, unique regardless of case;
     - `github_url` and `linkedin_url`: nullable, the link rules plus a host rule (`github.com` or `linkedin.com`, `www.` allowed).
     - **`self_described_skills` is unchanged.** It stays typed to the nine vocabulary ids and keeps its existing projection. The picker never writes it.
   - `credentials`:
     - `skill_id` becomes nullable, for a certification outside the vocabulary;
     - `issued_on` (date, nullable);
     - `credential_url` (nullable, ≤ 500).
   - The `confirmations.kind` CHECK gains `showcase`.
   - Every existing row keeps its values, and the `demo_data` rules are unchanged.
2. Engine endpoints (no token → 401, wrong role → 403, never 500):
   - `PUT /api/me/projects/{id}/showcase` (builder, owner only; someone else's project → 404):
     - body `{description, liveUrl, demoUrl, pitchVideoUrl, pitchDeckUrl, showcased}`;
     - any change to a showcase field, or `showcased=true`, sets `showcase_status=pending` and clears `showcase_confirmed_at`;
     - `showcased=false` sets `none`;
     - saving identical values changes nothing.
   - `POST /api/me/credentials` accepts optional `skillId`, `issuedOn` and `credentialUrl`.
   - `PUT /api/me/profile` gains **`skillSet`** (writes `profiles.skill_set`), `githubUrl` and `linkedinUrl`. `selfDescribedSkills` keeps its current meaning.
   - `POST /api/me/skills/suggest` (builder; D-50):
     - body `{resumeText}`, 50–20,000 chars;
     - answers `{available, suggestions: [{label, skillId | null}]}` with at most 20 suggestions; `skillId` is set only for a vocabulary match;
     - runs through a new `suggest_skills(text)` on the existing `LlmAdapter` (never `app/conversation`), with a strict schema and a Claude Haiku 4.5 model constant;
     - null adapter, no key or timeout → 200 `{available:false, suggestions:[]}`;
     - stores nothing and never logs the text.
   - `GET /api/showcase` (**public, no auth**):
     - query `skill` matches demonstrated, verified or `skill_set` skills, and each card reports which kind matched;
     - query `vertical`, `licensable`, `q` (case-insensitive title), `limit` (1–24, default 12), `offset`;
     - ordered by `showcase_confirmed_at desc, id`;
     - returns `{items, total}`.
   - `GET /api/showcase/{projectId}` (public): the detail. It exposes only `builderId`, never contact fields.
   - Admin:
     - `GET /api/admin/pending` includes `showcase` rows.
     - `POST /api/admin/{confirm|reject}/showcase/{id}` writes a `confirmations` row, sets or clears `showcase_confirmed_at`, and **reprojects once**, returning `projectedRows` (D-52).
     - A decision on a withdrawn entry (`showcased=false`) → 409 "Builder has withdrawn this entry".
     - `GET /api/admin/decided` lists showcase decisions, and the #49 reverse works for them.
3. Visibility rule. An entry is public only when `showcased = true` ∧ `showcase_status = confirmed` ∧ project `status = confirmed` ∧ owner account confirmed, checked as one SQL predicate:
   - anything else → absent from the list and 404 on detail;
   - only confirmed certifications appear publicly;
   - no Showcase response carries email, phone, location, day rate or availability.
4. Display-only facts (D-52, amends D-43 (1) and (2)). Showcase entries, `skill_set` labels, skill-less certifications and accepted suggestions enter the MeTTa space as facts **no rule reads**:
   - `(showcases <builder> <project>)`
   - `(has-skill-set <builder> "<label>")`
   - `(certified <builder> <cert> "<issuer>")`
   - `(suggested-skill <builder> "<label>")`

   Every free-text value is a quoted, escaped string atom. There are no new rule names, and the seven rules are untouched. A certification without a skill never yields `proves`.

   Invariant, replacing the byte-equal test: the five demo scenarios route deep-equal before and after these facts and the demo seed exist, and a builder with only typed or suggested skills stays ineligible.
5. URL rules:
   - `https://` only, at most 500 chars;
   - the host must not be `localhost`, an IP literal or an IDN lookalike;
   - `pitchVideoUrl` must be a YouTube URL (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`), and the engine returns the 11-character `videoId`;
   - violations → 422 with a field message.
6. Web:
   - **Showcase** link in `TopNav` (desktop section links and the mobile menu), visible signed in or out.
   - `/showcase` gallery:
     - card grid with the Demo data pill on every card;
     - filter chips (skill, vertical, Licensable IP) and a search box, with filters kept in the URL;
     - paging "Showing 1–12 of N";
     - empty state and skeleton loading.
   - `/showcase/:projectId` detail:
     - YouTube pitch as a click-to-load facade that embeds `https://www.youtube-nocookie.com/embed/<videoId>` only after a click;
     - Live / Demo / Pitch deck buttons opening in a new tab with `rel="noopener noreferrer"`;
     - description, vertical, completed date, demonstrated skills;
     - builder panel: verified skills with evidence badge, then `skill_set` chips under a "Self-described" label, then confirmed certifications, then GitHub and LinkedIn icons;
     - "View builder": a founder goes to `/builders/:id`; a signed-out visitor goes to `/sign-in`, with the caption "Contact details are shown only to signed-in founders.";
     - hidden or missing entry: "This project isn't on the Showcase." with "Back to Showcase".
   - `/profile`:
     - skill-set picker (combobox; vocabulary suggestions plus free text; removable chips; 20-chip counter) writing `skillSet`;
     - "Suggest from résumé" paste box with the caption "Your text is sent to Anthropic's Claude to suggest skills and is not stored.", and accept/dismiss chips. When unavailable, the button is disabled with "Suggestions need the assistant; add skills by hand.";
     - GitHub and LinkedIn fields;
     - certification form fields (issuer, issue date, verification link, optional vocabulary skill);
     - per-project "Showcase" editor with a status pill (Not shown / Pending review / Live / Rejected).
   - `/admin`:
     - a **Showcase** tab: card preview, links as text with the host highlighted, the parsed video id, "Project not yet confirmed" and "Account not confirmed" warnings, confirm / reject, and Decided with Reverse;
     - the Credentials tab badges skill-less certifications "No vocabulary skill: display only".
7. Demo content:
   - **Seed script.** It is idempotent and reads `services/engine/seed/showcase_demo.json`. It writes confirmed entries with fixed UUIDs and `demo_data` true, signs their `confirmations` rows with a seed admin that can't sign in, then reprojects once. It runs on `docker compose up` after migrations.
   - **Seed builders.** They are confirmed and `demo-`-prefixed. They have **no availability ranges and no `mobile` skill**. Each carries two or three `skill_set` chips and one skill-less certification.
   - **Entries (Q-18):**
     - **Venture Route**: owner Njuguna Njenga (`demo-njuguna-njenga`), vertical **education**, skills ai-metta, python, frontend and backend. It uses the Operator's live, YouTube and Canva links, with `https://example.org/venture-route/…` placeholders until they're supplied.
     - "Crop price SMS digest" (agri).
     - "School fees tracker" (education, licensable).
   - Seed IP assets stay MeTTa-only.
8. Chloe (D-51): everything in `planning/sprints/006-chloe-voice/requirements.md` §In scope, plus:
   - the `VoiceSessionProvider` mounts above the founder routes;
   - the "Voice: Chloe" switch sits in the founder header. It is remembered in `sessionStorage` and hidden offline and when `VITE_VOICE_PROVIDER=off`;
   - read-aloud on `/dashboard`: counts and the next upcoming booking, once on arrival and again on "Read aloud";
   - read-aloud on `/bookings/:id`: the state and the latest proposal in Africa/Nairobi time;
   - read-aloud is templated only from the dashboard and booking responses;
   - no voice commands.

### Out of scope (Part A)
- File or image uploads; only links and pasted résumé text.
- Voice commands on any screen.
- Likes, comments or ratings.
- Showcase entries, `skill_set`, skill-less certifications or résumé suggestions influencing routing or eligibility.
- Video hosts other than YouTube.
- Editing a confirmed project's routing fields (title, vertical, skills) from the showcase editor.
- Any change to the conversation contract (`packages/contracts/src/chat.ts`, `services/engine/app/models`, `services/engine/app/conversation`, `services/engine/seed/{rules,facts}.metta`, `briefs.json`).
- A new vertical.
- Seed IP assets as Showcase cards.
- LLM providers other than Anthropic.

### Edge cases
- Builder edits a live entry → it leaves the gallery until an admin re-confirms it.
- Admin rejects the underlying project → the entry disappears even if its showcase is confirmed.
- Account unconfirmed later → every entry of that builder disappears.
- Builder switches Showcase off → the entry disappears at once, and a pending admin decision on it answers 409.
- Certification without a skill → it never produces a `proves` atom, only `certified`. One with a vocabulary skill follows the Sprint 003 path unchanged.
- Duplicate skill in the picker → ignored regardless of case. A 21st chip is refused, with the counter.
- Skill label containing `"`, `\`, `(`, `)` or a newline → it becomes one string atom and can't add a second fact.
- Résumé suggest with no key, a timeout or a malformed model reply → `{available:false}`, and the manual picker still works.
- YouTube URL with extra parameters (`&t=30s`, `si=`) → still yields the right `videoId`.
- Q-22 default → the founder's name never reaches builders on bids, on bookings or in Chloe's read-aloud until a founder profile exists.

## Part B — Demo hardening (unchanged goal; no new features)
1. `docker compose up` brings up `db`, `engine` **and `web`** with migrations and seed applied. `README.md` documents: prerequisites, `.env.example`, the single launch command, the offline demo flag, and the demo script (scenarios in order with the expected screens).
2. Deploy (D-27): `docs/DEPLOY.md` step-by-step wizard:
   - engine Docker image to Railway (Render fallback), with `/health`;
   - web to Vercel with `VITE_API_URL`;
   - Neon `production` branch as `DATABASE_URL`, with `alembic upgrade head` as the release command;
   - every env var from `.env.example`, with where to paste it;
   - the Clerk instance and the session-token claim step.

   The Operator runs every `railway` and `vercel` command and pastes back the URLs and `/health` responses. The Builder never runs them.
3. `docs/DEMO.md`: click-by-click, timings, the named rules to mention, the judge-facing "change a constraint" moment, and a 30-second Showcase moment (Part A).
4. Recording (D-28): Playwright records `demo.spec.ts` (five scenarios, "change a constraint", Showcase, a Chloe voice moment on the fake provider) from a clean `docker compose up` after it passes twice. Saved under `docs/demo/`, linked from README. The UI shows "Offline demonstration mode" when `VITE_OFFLINE_DEMO=1`.
5. Pitch deck (D-28): a Slides artifact rebuilt from the existing pitch PDF (Q-19), plus `docs/PITCH.md` with a timed script per slide and the video on the demo slide. Team names are placeholders (Q-08).
6. Bug bash: any regressed acceptance line from 000–005a is fixed here. Also #51 (reprojection latency on Neon): measure it, then fix it or record a DECISIONS entry accepting it.
7. `docs/SUBMISSION.md`: repo link, demo URL, demo video, pitch deck link, `docs/PITCH.md`, PRD, rules/evidence screenshots.
8. Freeze: tag `v0.1.0-demo` on the merged commit; SHA in `STATE.md`.

### Out of scope (Part B)
New features of any kind.
