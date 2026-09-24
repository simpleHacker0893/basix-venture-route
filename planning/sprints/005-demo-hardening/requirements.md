# Sprint 005 — Builder Showcase, then demo hardening

**Part A window (Showcase):** Fri 25 Sep 08:00 → Sun 27 Sep 20:00 EAT, gate G5a. **Part B window (hardening):** Mon 28 Sep 08:00 → Wed 30 Sep 20:00 EAT, freeze 22:00 (G5). **Branches:** Part A `sprint/005a-showcase` (PR "Sprint 005a: Showcase"); Part B `sprint/005-demo-hardening` (PR "Sprint 005: Demo hardening"), cut from `master` after 005a merges (D-42). **Depends on:** Sprint 004 PR #78 merged (see `planning/STATE.md` §Blockers).

## Goal
Part A: builders show what they have built (title, description, live URL, demo URL, YouTube pitch, pitch deck), their certifications and their skill sets on a public **Showcase** tab in the header; founders and visitors browse it. Part B: a clean-launch demo from one command, a deployed copy run by the Operator (D-27), a recorded demo, a pitch deck and a README a judge can follow.

## Part A — Showcase (Operator request, 2026-09-24; D-42, D-43)

### User stories
1. As a builder, I add showcase details to one of my projects (description, live URL, demo URL, YouTube pitch link, pitch deck link) and switch "Show on Showcase" on, so founders see what I have shipped.
2. As a builder, I add a certification with its issuer, issue date and verification link, even when it does not map to one of the nine vocabulary skills.
3. As a builder, I pick my skill set from a list (the nine vocabulary skills as suggestions, plus anything I type) and it appears on my profile and my showcase cards.
4. As a founder or visitor, I open **Showcase** from the header, browse cards, filter by skill, vertical and "Licensable IP", search by title, and open a project page with its pitch video, links, and the builder's verified skills and certifications.
5. As a BASIX admin, I approve or reject a showcase entry in a new **Showcase** tab of `/admin` before it becomes public; an edit sends it back for review.
6. As a founder, from a showcase page I go to the builder's page (`/builders/:id`, founder-only, existing contact rules) to request an interview through the Sprint 004 flow.

### In scope
1. Alembic `0003_showcase`:
   - `projects`: `description` (text ≤ 1000, default ''), `live_url`, `demo_url`, `pitch_video_url`, `pitch_deck_url` (nullable, ≤ 500), `showcased` (bool, default false), `showcase_status` (`none | pending | confirmed | rejected`, default `none`, CHECK).
   - `credentials`: `skill_id` becomes nullable (a certification outside the vocabulary), `issued_on` (date, nullable), `credential_url` (nullable, ≤ 500).
   - `confirmations.kind` CHECK gains `showcase`.
   - Every existing row keeps its values; `demo_data` rules unchanged.
2. Engine endpoints:
   - `PUT /api/me/projects/{id}/showcase` (builder, owner only; 404 for someone else's project) — body `{description, liveUrl, demoUrl, pitchVideoUrl, pitchDeckUrl, showcased}`; any change to a showcase field or `showcased=true` sets `showcase_status=pending`; `showcased=false` sets `none`.
   - `POST /api/me/credentials` accepts optional `skillId`, `issuedOn`, `credentialUrl`.
   - `PUT /api/me/profile` keeps `selfDescribedSkills` (picker writes it; limits in D-43).
   - `GET /api/showcase` (**public, no auth**) — query `skill`, `vertical`, `licensable`, `q`, `limit` (≤ 24), `offset`; returns cards.
   - `GET /api/showcase/{projectId}` (public) — detail.
   - Admin: `GET /api/admin/pending` includes `showcase` rows; `POST /api/admin/{confirm|reject}/showcase/{id}` writes a `confirmations` row. **No reprojection** for showcase decisions.
3. Visibility rule: an entry is public only when `showcased = true` ∧ `showcase_status = confirmed` ∧ project `status = confirmed` ∧ owner account confirmed. Anything else → absent from the list and 404 on detail.
4. Display-only rule (D-43): showcase fields, certifications without a `skill_id`, and self-described skills **never** enter the MeTTa space. `render_program()` output for the existing demo rows is unchanged (byte-equal test).
5. URL rules: `https://` only; ≤ 500 chars; host must not be `localhost` or an IP literal. `pitchVideoUrl` must be a YouTube URL (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`); the engine returns the 11-character `videoId`. Violations → 422 with a field message.
6. Web:
   - **Showcase** link in `TopNav` (desktop section links and the mobile menu), visible signed in or out.
   - `/showcase` gallery: card grid, filter chips (skill, vertical, Licensable IP), search box, empty state, Demo data pill on every card.
   - `/showcase/:projectId` detail:
     - YouTube pitch as a click-to-load facade that embeds `https://www.youtube-nocookie.com/embed/<videoId>` only after a click;
     - Live / Demo / Pitch deck buttons opening in a new tab with `rel="noopener noreferrer"`;
     - description, vertical, completed date, demonstrated skills;
     - builder panel: verified skills with evidence badge, then self-described skills under a "Self-described" label, then confirmed certifications;
     - "View builder" (founder → `/builders/:id`; signed out → `/sign-in`).
   - `/profile`:
     - skill-set picker (combobox; vocabulary suggestions + free text; chips removable);
     - certification form fields (issuer, issue date, verification link, optional vocabulary skill);
     - per-project "Showcase" editor with status pill (Not shown / Pending review / Live / Rejected).
   - `/admin` **Showcase** tab: card preview, links, confirm / reject.
7. Demo content: a demo seed script adds showcase entries for the demo (labelled Demo data). Entry content comes from the Operator (Q-18); until then, entries with `https://example.org/...` links and no video.

### Out of scope (Part A)
File or image uploads (links only); likes, comments, ratings; showcase entries influencing routing or eligibility; video hosts other than YouTube; editing a confirmed project's routing fields (title, vertical, skills) from the showcase editor.

### Edge cases
- Builder edits a live entry → it leaves the gallery until an admin re-confirms.
- Admin rejects the underlying project → the entry disappears even if its showcase is confirmed.
- Account unconfirmed later → every entry of that builder disappears.
- Certification without a skill never produces a `proves` atom; one with a vocabulary skill follows the Sprint 003 path unchanged.
- A duplicate skill in the picker is ignored (case-insensitive).
- A YouTube URL with extra parameters (`&t=30s`, `si=`) still yields the right `videoId`.

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
4. Recording (D-28): Playwright records `demo.spec.ts` (five scenarios, "change a constraint", Showcase) from a clean `docker compose up` after it passes twice. Saved under `docs/demo/`, linked from README. The UI shows "Offline demonstration mode" when `VITE_OFFLINE_DEMO=1`.
5. Pitch deck (D-28): a Slides artifact rebuilt from the existing pitch PDF (Q-19), plus `docs/PITCH.md` with a timed script per slide and the video on the demo slide. Team names are placeholders (Q-08).
6. Bug bash: any regressed acceptance line from 000–005a is fixed here. Also #51 (reprojection latency on Neon): measure it, then fix it or record a DECISIONS entry accepting it.
7. `docs/SUBMISSION.md`: repo link, demo URL, demo video, pitch deck link, `docs/PITCH.md`, PRD, rules/evidence screenshots.
8. Freeze: tag `v0.1.0-demo` on the merged commit; SHA in `STATE.md`.

### Out of scope (Part B)
New features of any kind.
