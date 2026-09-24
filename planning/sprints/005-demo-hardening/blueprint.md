# Sprint 005 — blueprint (2026-09-24, Architect)

## Inherited
Read `planning/STATE.md` §What Sprint 004 inherits and the Sprint 004 PR #78 report first. Reuse, do not redefine:
- `require_role` / `current_user` (`app/auth/clerk.py`);
- the marketplace repo and models (`app/marketplace/*`);
- the `confirmations` log and the admin router (`app/api/admin.py`);
- `verified_skills(ConfirmedRows)` (D-39, display only);
- `MarketplaceApi` (`apps/web/src/api/marketplace.ts`);
- `RequireRole`, `StatusPill`, the Demo data pill, and `TopNav` (`apps/web/src/components/TopNav.tsx`);
- the Clerk Playwright harness (`apps/web/e2e/clerk/*`, ports 8001 / 4175).

Field limits follow D-40 and D-43.

## Part A — Showcase

### Files
```
services/engine/alembic/versions/0003_showcase.py         # projects + credentials columns, showcase_status CHECK, confirmations.kind CHECK += showcase
services/engine/app/marketplace/models.py                  # new columns
services/engine/app/marketplace/links.py                   # pure: validate_https_url(url) -> str | error; youtube_video_id(url) -> str | error
services/engine/app/marketplace/schemas.py                 # ShowcaseEdit, ShowcaseCard, ShowcaseDetail, CredentialCreate += issuedOn, credentialUrl, skillId optional
services/engine/app/marketplace/repo.py                    # showcase queries (visibility rule in one SQL predicate), set_showcase(), admin pending += showcase
services/engine/app/marketplace/projection.py              # skip credentials with skill_id NULL; nothing else changes
services/engine/app/api/showcase.py                        # GET /api/showcase, GET /api/showcase/{id} (no auth dependency)
services/engine/app/api/me.py (or projects router)         # PUT /api/me/projects/{id}/showcase
services/engine/app/api/admin.py                           # kind "showcase": confirm/reject without reproject()
services/engine/scripts/seed_showcase_demo.py              # idempotent demo entries (demo_data true), content from Q-18
services/engine/tests/test_links.py                        # pure table test
services/engine/tests/test_showcase.py                     # HTTP seam: visibility table, edit → pending, auth
services/engine/tests/test_projection_display_only.py      # byte-equal render_program invariant
packages/contracts/src/marketplace.ts                      # Zod mirrors + parity
apps/web/src/features/showcase/ShowcasePage.tsx            # gallery, filters, search, empty state
apps/web/src/features/showcase/ShowcaseDetailPage.tsx      # facade video, links, builder panel
apps/web/src/features/showcase/PitchVideo.tsx              # click-to-load youtube-nocookie facade
apps/web/src/features/builder/SkillPicker.tsx              # combobox, chips
apps/web/src/features/builder/ShowcaseEditor.tsx           # per-project editor + status pill
apps/web/src/features/builder/CredentialForm (extend)      # issuer, issued date, link, optional skill
apps/web/src/features/admin/ShowcaseTab.tsx                # queue tab
apps/web/src/components/TopNav.tsx                         # + Showcase link (desktop + mobile)
apps/web/src/router.tsx                                    # + /showcase, /showcase/:projectId (public)
apps/web/e2e/showcase.spec.ts                              # no-key suite, route-stubbed engine
apps/web/e2e/clerk/showcase.spec.ts                        # builder → admin → signed-out visitor
docs/API.md                                                # new endpoints
```

### Steps (ticket order; blockers in brackets)
1. **Migration 0003 + models** [—]. Upgrade and downgrade tested.
2. **Links module** (pure) [—]: https / host / length rules, YouTube id extraction; table test.
3. **Contracts** [1]: Zod mirrors, schema export, parity test.
4. **Projection display-only guard** [1]: skip skill-less credentials; byte-equal invariant test.
5. **Builder writes** [1, 2, 3]: `PUT /api/me/projects/{id}/showcase` and the credential extension; edit → `pending`; owner-only 404.
6. **Public read** [5]: `GET /api/showcase` (filters, pagination) and detail; the visibility table test.
7. **Admin showcase kind** [5]: pending list and confirm/reject with no reprojection; a `confirmations` row per decision.
8. **Web: MarketplaceApi + routes + TopNav link** [3] (prefactor).
9. **Web: gallery** [6, 8]: RTL for cards, filters, Demo data pill, empty state.
10. **Web: detail + PitchVideo facade** [6, 8]: RTL (no iframe before click; nocookie src after; rel attributes).
11. **Web: profile** [5, 8]: SkillPicker, certification fields, ShowcaseEditor with status pill.
12. **Web: admin Showcase tab** [7, 8].
13. **Demo seed script** [5, 7]: idempotent, Demo data. Content from Q-18, else placeholders.
14. **Playwright**: the no-key `showcase.spec.ts` [9, 10] and the Clerk `showcase.spec.ts` [11, 12].
15. *(Should)* **#49** admin reverse, including showcase rows [7, 12].

### Design source
There is no Stitch export for Showcase (Q-17). If `design/stitch/batch-6/showcase-gallery` and `showcase-detail` land by Fri 25 Sep 18:00, they win (D-36). Otherwise compose from existing exports with the DESIGN.md tokens:
- `batch-4/requests-board` for the card grid and filter chips;
- `batch-3/candidate-profile` for the builder panel;
- `batch-3/add-project` for the editor.

### Testing plan (seams, fixed)
- pytest at the HTTP seam against `TEST_DATABASE_URL`, with fake JWTs per role and no token for the public routes.
- `links.py` and the projection invariant as pure-function tests.
- RTL through rendered screens only (no component-internal tests).
- The Playwright no-key suite with `page.route` stubs for `/api/showcase*`.
- The Clerk suite for the three-role flow.
- Also `uv run mypy .`, ruff, `pnpm -r typecheck`, `pnpm -r lint`.

### Wave plan (D-41 style, isolated worktrees)
Ticket numbers are assigned by `/to-tickets`; waves follow the brackets above:
- W0: 1, 2
- W1: 3, 4, 5
- W2: 6, 7, 8
- W3: 9, 10, 11, 12
- W4: 13, 14
- W5: 15

### Scope floor for Part A (if G5a at Sun 27 Sep 20:00 is at risk)
Keep 1–10 and 14 (no-key suite only). Cut the skill picker, certification extension, admin tab and Clerk spec, and seed confirmed entries directly with the script. If even that misses the gate, the Showcase link is hidden behind `VITE_SHOWCASE=0` and Part B starts on time.

## Part B — Demo hardening

### Files
```
docker-compose.yml             # + web service (multi-stage build → static preview on 5173), engine depends_on db healthy, migrate + seed on start
apps/web/Dockerfile            # multi-stage, non-root
services/engine/Dockerfile     # port c025647 (Hyperon init in Docker) if not on master
apps/web/e2e/demo.spec.ts      # five scenarios in DEMO.md order + change-a-constraint + Showcase
docs/DEMO.md, docs/DEPLOY.md, docs/PITCH.md, docs/SUBMISSION.md, docs/demo/*
README.md
```

### Steps
1. **Regressions first**: run every acceptance suite 000–005a on `master`; one ticket per regression.
2. **Compose `web` service** and a clean-clone launch; README launch section.
3. **#51**: time `reproject()` against Neon `dev` five times; fix it (e.g. one reprojection per request, connection reuse), or record D-44 accepting the number with the reason.
4. **`demo.spec.ts` + `docs/DEMO.md`**.
5. **Recording** to `docs/demo/` after two green passes.
6. **`docs/PITCH.md`** + Slides deck (Q-19 for the source PDF).
7. **`docs/DEPLOY.md`** wizard, then the Operator deploys and pastes the URLs and `/health`.
8. **`docs/SUBMISSION.md`**, then freeze: tag `v0.1.0-demo`, SHA in `STATE.md`.

### Testing plan
`demo.spec.ts` against the compose stack. HTTP checks on the deployed `/health` and landing page. Every earlier acceptance suite on the freeze commit.
