# Graph Report - basix-venture-route  (2026-09-23)

## Corpus Check
- Large corpus: 720 files · ~477,075 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2273 nodes · 5368 edges · 114 communities (99 shown, 13 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 657 edges (avg confidence: 0.9)
- Token cost: 887,012 input · 0 output

## Community Hubs (Navigation)
- Sprint 002 Web Decisions
- Admin Queue Tests
- Marketplace SQLModel Tables
- MeTTa Atom Conversion
- Stack and CI Jobs
- Test Seams and Web API
- Engine Query Witnesses
- MettaRouteEngine Runtime
- Provisioning State Snapshot
- Route Models and Assembler
- Popover and Brief Editor
- Builder Profile API
- Brief Review Screen
- Engine Settings
- Operating Rules and Roles
- Web Package Config
- Web API Client
- Brief Extraction Adapters
- Founder Dashboard Screen
- Eligibility Witness Merging
- Engine Test Fixtures
- Intake Screen Components
- Deployment Prompts and Env
- API Dependencies and Health
- Clerk Webhook Route
- Add Project and Admin Queue Screens
- Me Router Handlers
- Conversation Orchestrator
- Fake Engine Test Harness
- Auth Seam Tests
- Sheet Component
- Handoff Screen and Badges
- Web TS App Config
- Sprint Automation Process
- Webhook Test Helpers
- Marketplace Zod Contracts
- Button Calendar Composer
- Landing Page Screenshot
- Anthropic Adapter Tests
- shadcn components.json
- Web Dev Dependencies
- Batch 3 Marketplace Exports
- Contracts Package Config
- PRD Risks and Design Source
- Sprint 001 Blueprint
- Anthropic Adapter
- Web Runtime Dependencies
- Deterministic Status and Partner Fit
- Availability and Gap Rules
- Voice Intake Screenshot
- Nav Footer Landing
- Batch 4 Dashboard Exports
- Admin Router
- Verified Skills and Marketplace Rules
- Node TS Config
- Store Engine and Clerk Admin
- Batch 1 Route Exports
- Composition Root and Snapshot
- ADRs and Operator Context
- Assembler Gap Decisions
- Conversation Route and LLM Base
- Contract Types Glossary
- Intake Screen Exports
- Evidence and Demo Data UI
- JWKS Cache
- Contracts TS Config
- Route Zod Contracts
- Schema Parity Test
- Clerk Session Verification
- Scenario API Tests
- Playwright E2E Suite
- Brief Zod Contracts
- Graph Projection
- Stitch Export Process
- Root Package Config
- Chat Zod Contracts
- Conversation API Tests
- Brief Panel and Context Cards
- Engine Query Screenshot
- Turbo Tasks
- Badge and Toggle
- Sign-in and Landing Exports
- Internal Query Tests
- Route API Tests
- Demo Data Principle
- LLM Boundary
- Web Scripts
- Alembic Migration 0001
- Test JWT Signing
- Engine Error Tests
- Alembic Environment
- Health Endpoint Facts
- Contracts Build Config
- Schema Tests
- App Icons
- Web TS References
- Sonner Toaster
- Handoff Export Embellishments
- Health Tests
- Pydantic Validators
- Screenshots Script
- API Package
- Auth Package
- Conversation Package
- DB Package
- Engine Package
- App Package
- LLM Package
- Demo Data Check
- Models Package
- Tests Package
- Engine Project Name

## God Nodes (most connected - your core abstractions)
1. `MettaRouteEngine` - 106 edges
2. `VentureBrief` - 68 edges
3. `Settings` - 58 edges
4. `Sprint 006 — Chloe voice intake` - 38 edges
5. `VentureRoute` - 37 edges
6. `User` - 36 edges
7. `Sprint 002 — acceptance` - 34 edges
8. `create_app()` - 32 edges
9. `PartialBrief` - 31 edges
10. `Sprint 003 — Marketplace (Clerk + Neon Postgres + graph projection)` - 31 edges

## Surprising Connections (you probably didn't know these)
- `ADR 0001 (D-01): Engine is Python 3.12 + FastAPI + Pydantic v2 with hyperon in-process` --rationale_for--> `MettaRouteEngine`  [INFERRED]
  docs/adr/0001-engine-is-python-fastapi-with-hyperon-in-process.md → services/engine/app/engine/metta_engine.py
- `ADR 0009 (D-19): Test seams are fixed per sprint` --references--> `MettaRouteEngine`  [EXTRACTED]
  docs/adr/0009-test-seams-are-fixed-per-sprint.md → services/engine/app/engine/metta_engine.py
- `Reasoning path { rule, facts, conclusion }` --semantically_similar_to--> `ReasoningPath type`  [INFERRED] [semantically similar]
  CONTEXT.md → docs/PRD.md
- `Deterministic route assembly (§5.6)` --semantically_similar_to--> `Team assembly (deterministic, Python)`  [INFERRED] [semantically similar]
  docs/PRD.md → planning/DOMAIN.md
- `POST /internal/query (dev-only)` --references--> `MettaRouteEngine`  [EXTRACTED]
  docs/API.md → services/engine/app/engine/metta_engine.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sprint gating pipeline: merge check → tickets → completion report → Architect review → timeline gate** — planning_automation_merge_check, planning_automation_routines, planning_automation_completion_report, planning_automation_architect_builder_review, planning_decisions_d_12 [INFERRED 0.85]
- **Engine health check flow (Swagger -> GET /health -> knowledge-base load report)** — docs_images_engine_health_swagger_venture_route_engine, docs_images_engine_health_swagger_health_endpoint, docs_images_engine_health_swagger_health_response, docs_images_engine_health_swagger_hyperon, docs_images_engine_health_swagger_facts_and_rules_knowledge_base [EXTRACTED 1.00]
- **Eligible Builder Match for brief-constrained-01** — docs_images_engine_query_response_brief_constrained_01, docs_images_engine_query_response_zawadi_njoroge, docs_images_engine_query_response_credential_evidence, docs_images_engine_query_response_admin_basix_confirmation, docs_images_engine_query_response_eligible_builder_rule [EXTRACTED 1.00]
- **The seven named MeTTa rules that form the decision layer** — context_verified_for_skill, context_mode_compatible, context_available_for_brief, context_eligible_builder, context_reuse_fit, context_partner_fit, context_route_gap [EXTRACTED 1.00]
- **Per-sprint Builder prompt chain P1 → P2 → P3 → P4 → P5** — planning_prompts_p1_orient, planning_prompts_p2_to_tickets, planning_prompts_p3_implement, planning_prompts_p4_code_review, planning_prompts_p5_acceptance_and_pr [EXTRACTED 1.00]
- **Deterministic route status: gaps from MeTTa and the assembler, status as a pure function** — agents_deterministic_status, planning_decisions_d_09, planning_decisions_d_22, planning_decisions_d_23, context_route_gap, context_assembler_team_size_fit, context_assembler_budget_fit, planning_domain_team_assembly, docs_prd_deterministic_route_assembly [INFERRED 0.85]
- **Route computation pipeline (conversation -> orchestrator -> route service -> assembler -> engine -> VentureRoute)** — planning_sprints_001_routing_core_requirements_post_api_conversation, planning_sprints_001_routing_core_requirements_conversation_orchestrator, planning_sprints_001_routing_core_requirements_route_service, planning_sprints_001_routing_core_requirements_assembler, planning_sprints_001_routing_core_blueprint_metta_route_engine, planning_sprints_001_routing_core_requirements_venture_route [INFERRED 0.85]
- **Chat, form and voice paths yield the identical route** — planning_sprints_001_routing_core_requirements_post_api_route, planning_sprints_001_routing_core_requirements_post_api_conversation, planning_sprints_001_routing_core_acceptance_form_chat_equality, planning_sprints_006_chloe_voice_blueprint_send_turn, planning_sprints_006_chloe_voice_requirements_chloe, planning_sprints_002_founder_ui_requirements_brief_form [INFERRED 0.85]
- **Admin confirm -> reproject -> route includes user-entered builder** — planning_sprints_003_marketplace_requirements_admin_queue, planning_sprints_003_marketplace_requirements_reproject, planning_sprints_001_routing_core_blueprint_metta_route_engine, planning_sprints_003_marketplace_requirements_verified_skill_rule, planning_sprints_003_marketplace_requirements_demo_data_flag, planning_sprints_003_marketplace_blueprint_health_projected_rows [INFERRED 0.85]
- **Founder routing flow: intake to brief review to route result to evidence drawer to handoff** — design_stitch_batch_1_founder_intake_index_founder_intake_screen, design_stitch_batch_1_brief_review_index_brief_review_screen, design_stitch_batch_1_route_result_feasible_index_route_result_feasible_screen, design_stitch_batch_1_route_result_partial_index_route_result_partial_screen, design_stitch_batch_1_why_this_route_drawer_index_why_this_route_drawer_screen, design_stitch_batch_2_venture_handoff_index_venture_handoff_screen [EXTRACTED 1.00]
- **Admin confirmation gate: builder profile, add project and sign-up all wait on the admin queue** — design_stitch_batch_3_admin_queue_index_admin_queue_screen, design_stitch_batch_3_builder_profile_index_account_status_card, design_stitch_batch_3_add_project_index_what_happens_next_strip, design_stitch_batch_2_sign_in_index_admin_confirmation_caption [INFERRED 0.85]
- **Marketplace loop: requests board bid, founder dashboard bids, candidate profile, interview booking** — design_stitch_batch_4_requests_board_index_bid_dialog, design_stitch_batch_4_founder_dashboard_index_bids_received_card, design_stitch_batch_3_candidate_profile_index_book_interview_action, design_stitch_batch_4_interview_booking_index_interview_booking_screen [INFERRED 0.85]
- **Founder routing flow: conversational intake -> structured brief review -> route result (feasible or partial) -> why-this-route explanation drawer** — design_stitch_batch_1_founder_intake_screenshot_founder_intake_screen, design_stitch_batch_1_brief_review_screenshot_brief_review_screen, design_stitch_batch_1_route_result_feasible_screenshot_route_result_feasible_screen, design_stitch_batch_1_route_result_partial_screenshot_route_result_partial_screen, design_stitch_batch_1_why_this_route_drawer_screenshot_why_this_route_drawer_screen [INFERRED 0.95]
- **Deterministic explainability pattern: named MeTTa rules surface consistently in the disclaimer, rules-applied footer, evidence drawers and proof cards** — design_stitch_batch_1_brief_review_screenshot_deterministic_rules_disclaimer, design_stitch_batch_1_route_result_feasible_screenshot_rules_applied_footer, design_stitch_batch_1_route_result_feasible_screenshot_evidence_trail_drawer, design_stitch_batch_1_route_result_partial_screenshot_evidence_chain_drawer, design_stitch_batch_1_why_this_route_drawer_screenshot_rule_name_badge [INFERRED 0.95]
- **Partial-route relief loop: gap detected -> approved relief option applied -> brief constraint (availability or skills) changed -> route recomputed** — design_stitch_batch_1_route_result_partial_screenshot_gaps_panel, design_stitch_batch_1_route_result_partial_screenshot_approved_relief_options, design_stitch_batch_1_brief_review_screenshot_availability_window_calendar, design_stitch_batch_1_brief_review_screenshot_required_skills_chips, design_stitch_batch_1_route_result_feasible_screenshot_route_result_feasible_screen [INFERRED 0.85]
- **Founder journey across batch-2 screens: landing pitch, sign in and select founder intent, deterministic route, plain-text venture handoff** — design_stitch_batch_2_landing_page_screenshot_hero_smallest_credible_route, design_stitch_batch_2_landing_page_screenshot_how_it_works_three_steps, design_stitch_batch_2_sign_in_screenshot_select_intent_role_cards, design_stitch_batch_2_venture_handoff_screenshot_venture_handoff_screen [INFERRED 0.75]
- **Determinism proof chain on the handoff: structured export, rules applied bar, ledger attestation digest, verification details** — design_stitch_batch_2_venture_handoff_screenshot_structured_export_read_only, design_stitch_batch_2_venture_handoff_screenshot_rules_applied_bar, design_stitch_batch_2_venture_handoff_screenshot_ledger_attestation, design_stitch_batch_2_venture_handoff_screenshot_verification_details [INFERRED 0.85]
- **Builder submission -> admin confirmation -> verified badge on candidate profile** — design_stitch_batch_3_add_project_screenshot_submit_for_confirmation, design_stitch_batch_3_add_project_screenshot_what_happens_next_steps, design_stitch_batch_3_admin_queue_screenshot_pending_items_table, design_stitch_batch_3_admin_queue_screenshot_credential_detail_panel, design_stitch_batch_3_candidate_profile_screenshot_projects_verified_repo, design_stitch_batch_3_candidate_profile_screenshot_verified_skills_evidence [INFERRED 0.85]
- **Builder-entered profile data (skills, availability, modes, contact sharing) projected onto founder-facing candidate profile** — design_stitch_batch_3_builder_profile_screenshot_skills_list, design_stitch_batch_3_builder_profile_screenshot_availability_calendar, design_stitch_batch_3_builder_profile_screenshot_delivery_modes_location, design_stitch_batch_3_builder_profile_screenshot_contact_sharing_toggles, design_stitch_batch_3_candidate_profile_screenshot_candidate_header, design_stitch_batch_3_candidate_profile_screenshot_shared_contact_panel [INFERRED 0.85]
- **Builder bid to founder review to interview booking flow** — design_stitch_batch_4_requests_board_screenshot_bid_modal, design_stitch_batch_4_founder_dashboard_screenshot_bids_received_rail, design_stitch_batch_4_interview_booking_screenshot_interview_booking_screen, design_stitch_batch_4_founder_dashboard_screenshot_upcoming_interviews_panel [INFERRED 0.85]
- **Deterministic MeTTa rule evaluation and ledger trust signals shown on every screen** — design_stitch_batch_4_founder_dashboard_screenshot_deterministic_engine_notice, design_stitch_batch_4_founder_dashboard_screenshot_ledger_sync_status_badge, design_stitch_batch_4_interview_booking_screenshot_metta_rule_footnote, design_stitch_batch_4_requests_board_screenshot_deterministic_rule_evaluation_notice [INFERRED 0.85]
- **Interview proposal lifecycle: slot pick, propose, counter-proposal, accepted/confirmed** — design_stitch_batch_4_interview_booking_screenshot_date_time_slot_picker, design_stitch_batch_4_interview_booking_screenshot_booking_summary_card, design_stitch_batch_4_interview_booking_screenshot_counter_proposal_card, design_stitch_batch_4_interview_booking_screenshot_status_lifecycle_stepper [EXTRACTED 1.00]
- **Voice intake loop: founder speaks, engine detects missing fields, Chloe asks, founder answers via hold-to-talk** — design_stitch_batch_5_founder_intake_voice_screenshot_founder_transcript_card, design_stitch_batch_5_founder_intake_voice_screenshot_evaluation_engine_panel, design_stitch_batch_5_founder_intake_voice_screenshot_chloe_spoken_question, design_stitch_batch_5_founder_intake_voice_screenshot_hold_to_talk_input [INFERRED 0.95]
- **Brief gating: resolved and missing parameters feed a deterministic MeTTa rule that gates the Find my route action** — design_stitch_batch_5_founder_intake_voice_screenshot_resolved_parameters, design_stitch_batch_5_founder_intake_voice_screenshot_required_missing_parameters, design_stitch_batch_5_founder_intake_voice_screenshot_deterministic_rule_match, design_stitch_batch_5_founder_intake_voice_screenshot_find_my_route_button [INFERRED 0.85]

## Communities (114 total, 13 thin omitted)

### Community 0 - "Sprint 002 Web Decisions"
Cohesion: 0.06
Nodes (76): CI web job, CORS_ORIGINS allow-list (D-30), D-29 Next actions for skill/availability/mode/location gaps are the engine's fixed strings (_GAP_NEXT_ACTIONS); UI renders one button per entry, D-30 Browser calls the engine cross-origin: CORSMiddleware from CORS_ORIGINS; Vite dev proxy; credentials on in Sprint 003, D-31 Why this route? Technical view renders ReasoningPath objects already in VentureRoute; no route.debug, D-32 PWA check is Playwright on vite preview, not Lighthouse (manifest, service worker, offline shell, offline demo routes), D-33 GitHub Actions CI added in Sprint 002 (engine and web jobs, no secrets), D-34 Offline demo snapshot is generated by export_offline_snapshot.py, never hand-written (+68 more)

### Community 1 - "Admin Queue Tests"
Cohesion: 0.10
Nodes (67): _admin(), _evidence(), _mobile_builder(), Any, AsyncClient, AsyncSession, Bearer, Seams: HTTP /api/admin/* with a fake admin JWT, and `reproject()` observed only… (+59 more)

### Community 2 - "Marketplace SQLModel Tables"
Cohesion: 0.09
Nodes (58): datetime, Availability, Confirmation, Credential, DemoRow, _now(), Profile, Project (+50 more)

### Community 3 - "MeTTa Atom Conversion"
Cohesion: 0.08
Nodes (42): atom_to_term(), expect_list(), expect_symbol(), fact_atom(), facts_text(), Atom, Term, Atom <-> Python conversion. Parsing only; no selection logic lives here. (+34 more)

### Community 4 - "Stack and CI Jobs"
Cohesion: 0.08
Nodes (51): CI engine job, CI Postgres service container (postgres:18), apps/web stack (React 19, Vite, Tailwind, shadcn/ui, PWA, Clerk React), Non-negotiable 7: Form fallback always works, Installed skills per sprint, packages/contracts (Zod schemas + JSON Schema export), services/engine stack (Python 3.12, FastAPI, hyperon 0.2.10, SQLModel/Alembic/asyncpg), compose db service (postgres:18) (+43 more)

### Community 5 - "Test Seams and Web API"
Cohesion: 0.12
Nodes (51): D-19 Test seams fixed per sprint in planning/PROMPTS.md; tdd tests only there, Q-14 Chloe confirmation phrase list additions (open, Architect recommends yes), R-11 Real speech recognition cannot run in CI (Sprint 006 tests only exercise the fake provider), GET /api/scenarios, ChatResponse, POST /api/conversation, API client (apps/web/src/api/client.ts), Playwright suite (apps/web/e2e, playwright.config.ts) (+43 more)

### Community 6 - "Engine Query Witnesses"
Cohesion: 0.06
Nodes (37): ReusableIp, RouteCohort, RoutePartner, _brief_atoms(), Atom, (builder, skill, evidence) tuples from `eligible-builder`, evidence folded to…, Licensable assets in the brief's vertical that demonstrate a required skill., skill / availability / mode / location gaps per required skill from `route-gap`. (+29 more)

### Community 7 - "MettaRouteEngine Runtime"
Cohesion: 0.08
Nodes (26): ADR 0001 (D-01): Engine is Python 3.12 + FastAPI + Pydantic v2 with hyperon in-process, MettaRouteEngine, MeTTa, Path, Parse a seed file and add every atom to the space; returns the atom count., Ask the space which of the seven named rules have at least one equation loaded., Owns the MeTTa instance. All decisions come from the named rules in rules.metta., A fresh Hyperon runtime holding the seed facts, the rules and the overlap… (+18 more)

### Community 8 - "Provisioning State Snapshot"
Cohesion: 0.09
Nodes (44): Sprint 000 engine models (EligibleTuple, ReuseCandidate, PartnerCandidate, CohortInfo, Gap, ReasoningPath, RuleName), MettaRouteEngine, Finding: asyncpg rejects sslmode/channel_binding, GET /health, PR #33 Sprint 002: Founder UI, asyncpg connection string form (postgresql+asyncpg://...?ssl=require), Clerk application venture_route (app_3JhCRjM1hxEOxLGT8WtytYs5nuI), Clerk session token metadata claim (+36 more)

### Community 9 - "Route Models and Assembler"
Cohesion: 0.09
Nodes (37): EngineModel, Gap, BaseModel, VentureRoute: the engine's answer to a brief (PRD §5.4, planning/DOMAIN.md…, ReusableIp, RouteBuilder, RouteCohort, RoutePartner (+29 more)

### Community 10 - "Popover and Brief Editor"
Cohesion: 0.08
Nodes (31): Popover(), PopoverContent(), PopoverTrigger(), BriefEditor(), submit(), BriefEditorProps, DEMO_MONTH, Draft (+23 more)

### Community 11 - "Builder Profile API"
Cohesion: 0.11
Nodes (37): BuilderProfile, ProfileSkill, Builder routes under /api/me/* (spec #35 §Marketplace API). Router-level guard:…, _render(), Marketplace: builders, credentials, projects and confirmations in Neon Postgres…, AvailabilityRange, BuilderProfile, Contact (+29 more)

### Community 12 - "Brief Review Screen"
Cohesion: 0.08
Nodes (42): Availability window dual-month calendar range picker (22 Sep - 6 Oct 2026, Active Cycle Calendar), Brief Review Screen (Confirm your brief, Step 02 Review & Fit Restriction), Daily budget USD input with budget-must-be-positive validation note, Delivery mode segmented control (Remote / Hybrid / On site), Deterministic rules disclaimer (routing uses named MeTTa rules, nothing decided by a language model), Find my route primary CTA with Back to chat secondary action, Prefer reusable IP toggle (prioritise builders whose projects offer comparable primitives), Required skills chip input (Python, AI/MeTTa, UI/UX + Add skill) (+34 more)

### Community 13 - "Engine Settings"
Cohesion: 0.09
Nodes (24): BaseSettings, field_validator, Settings (pydantic-settings). Read from environment and an optional .env file., The JWT issuer Clerk uses: the origin of the JWKS URL (no path)., Alembic's URL: the explicit override, then the direct URL, then the pooled one., Reads the repo-root `.env` (where the Operator places every key, D-26), then an…, Settings, AnthropicAdapter: the real LlmAdapter (D-06) behind the same protocol as… (+16 more)

### Community 14 - "Operating Rules and Roles"
Cohesion: 0.09
Nodes (35): Architect role (120x-architect skill), Builder role (Claude Code session), Conventions (Conventional Commits, ruff/mypy strict, ISO dates, integer USD, kebab-case seed IDs), Non-negotiable 1: MeTTa is the only decision layer, Non-negotiable 10: No invented business facts, AGENTS.md operating rules, Reviewer role (sprint-reviewer subagent), How a sprint runs (+27 more)

### Community 15 - "Web Package Config"
Cohesion: 0.07
Nodes (32): typescript, vitest, zod, name, private, type, version, date-fns (+24 more)

### Community 16 - "Web API Client"
Cohesion: 0.12
Nodes (22): ApiUnreachableError, ApiValidationError, createApiSource(), request(), FetchLike, Scenarios, createDefaultSource(), canonical() (+14 more)

### Community 17 - "Brief Extraction Adapters"
Cohesion: 0.16
Nodes (27): ExtractedBrief, BaseModel, What intake may extract from a founder message: every field optional, nothing…, Brief fields stated in `message`; `current` is context only. Raises…, NullAdapter, NullAdapter: the LLM-free path used when no key is configured or…, Extracts nothing (the structured form supplies every field) and explains with…, ChatTurn (+19 more)

### Community 18 - "Founder Dashboard Screen"
Cohesion: 0.09
Nodes (33): Bids Received Side Rail (builder name, skill, USD day rate), Briefs and Routes Table (Brief, Status, Team, Day rate, Updated, Actions), Deterministic Evaluation Engine Active Notice, Export Ledger CSV Action, Founder Dashboard Screen (Your ventures), Founder Workspace / Deterministic Portfolio Registry Breadcrumb, Ledger Sync / Block Verified Status Badge, New Brief Primary CTA (+25 more)

### Community 19 - "Eligibility Witness Merging"
Cohesion: 0.10
Nodes (24): _EligibleWitness, (reuse asset s (facts...)); one witness per (asset, required skill)., (eligible b s ev (verified facts) (mode facts) (avail facts) (account fact)), Same builder and skill seen again: union the facts, fold evidence to `both`., _ReuseWitness, _union(), EligibleTuple, LookupName (+16 more)

### Community 20 - "Engine Test Fixtures"
Cohesion: 0.12
Nodes (30): async_sessionmaker, AsyncConnection, get_settings(), anyio_backend(), api(), bearer(), briefs(), clerk_admin() (+22 more)

### Community 21 - "Intake Screen Components"
Cohesion: 0.14
Nodes (21): OFFLINE_BANNER, ApiBanner(), OfflineBanner(), ChatThread(), ChatThreadProps, IntakePage(), confirmBrief(), ScenarioChips() (+13 more)

### Community 22 - "Deployment Prompts and Env"
Cohesion: 0.16
Nodes (30): D-27 Railway and Vercel CLI commands are run by the Operator by hand from docs/DEPLOY.md, D-28 Demo assets: Playwright-recorded demo video under docs/demo/, Slides pitch deck with docs/PITCH.md, team names placeholder, PROMPTS §Sprint 005 Demo hardening and deployment, Q-05 Railway/Vercel project names (closed by D-27), Q-06 Public URL required at submission? (open), Q-08 Team member names (open, placeholder per D-28), Q-09 Demo time and slot length (open), Clerk test users (+clerk_test emails, code 424242) (+22 more)

### Community 23 - "API Dependencies and Health"
Cohesion: 0.11
Nodes (26): get_engine(), get_route_service(), get_seed_briefs(), Request, health(), HealthResponse, BaseModel, Depends (+18 more)

### Community 24 - "Clerk Webhook Route"
Cohesion: 0.13
Nodes (25): _clerk_admin(), clerk_webhook(), AsyncSession, BaseModel, Depends, post, Request, POST /api/webhooks/clerk (D-03, spec #35 §Clerk webhook). Outside the auth… (+17 more)

### Community 25 - "Add Project and Admin Queue Screens"
Cohesion: 0.11
Nodes (27): Add Showcase Project screen, Include-in-projection toggle (project visible in graph after confirmation), Project submission form (title, verified skills, summary, evidence link, completion date), Submit for confirmation CTA (green primary button, Cancel secondary), Verified-skill selector tabs (Python, Rust, etc.) restricting project to confirmed skills, What happens next: Submitted -> Admin review -> Live in graph three-step strip, Admin Confirmation Queue screen, Expanded credential detail: issuer, cryptographic signature, MeTTa fact projection preview, Confirm credential / Reject / Inspect node proof (+19 more)

### Community 26 - "Me Router Handlers"
Cohesion: 0.18
Nodes (26): put, RoleResponse, choose_role(), _clerk_admin(), create_credential(), create_project(), _credential_out(), _engine() (+18 more)

### Community 27 - "Conversation Orchestrator"
Cohesion: 0.13
Nodes (23): brief_id_for(), merge(), missing_fields(), PartialBrief, Orchestrator: one founder turn -> exactly one ChatResponse (PRD §5.2;…, Extracted values (the latest message) override the current brief; None means…, to_brief(), request_validation_handler() (+15 more)

### Community 28 - "Fake Engine Test Harness"
Cohesion: 0.16
Nodes (13): clarificationFor(), EMPTY_PARTIAL, engineFetch(), FetchLike, jsonResponse(), Overrides, renderApp(), REQUIRED_FIELDS (+5 more)

### Community 29 - "Auth Seam Tests"
Cohesion: 0.18
Nodes (25): AsyncClient, AsyncSession, Bearer, parametrize, Seam: HTTP endpoints under /api/me/* and /api/admin/* with a fake Clerk JWT…, Placeholder CLERK_JWKS_URL (D-26): empty cache, nothing to fetch, every gated…, Placeholder DATABASE_URL (D-26): routing works, marketplace routes answer 503., D-30: Sprint 003 turns credentials on for the Clerk bearer header. (+17 more)

### Community 30 - "Sheet Component"
Cohesion: 0.13
Nodes (16): Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetTitle(), Tabs(), TabsContent(), TabsList() (+8 more)

### Community 31 - "Handoff Screen and Badges"
Cohesion: 0.12
Nodes (17): HandoffBody(), HandoffScreen(), handoffFileName(), handoffText(), EVIDENCE_CLASS, EvidenceBadge(), STATUS_CLASS, StatusBadge() (+9 more)

### Community 32 - "Web TS App Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, jsx, lib, module (+16 more)

### Community 33 - "Sprint Automation Process"
Cohesion: 0.17
Nodes (25): Architect Builder Review (gate check), AUTOMATION — how sprints run without a human, Completion report (PR body, 8 items), Merge check (first lines of every handoff prompt), Claude Code Remote Routines (vr-sprint-000..005, vr-gate-check), sprint-builder subagent, sprint-reviewer subagent, D-11 Sprint 000 time-boxed to half a day; abort criterion escalates to a MeTTa mentor, never a matcher (+17 more)

### Community 34 - "Webhook Test Helpers"
Cohesion: 0.21
Nodes (22): clerk_user_event(), Sign `body` the way Svix (and therefore Clerk) does: HMAC-SHA256 over…, The parts of a Clerk `user.*` webhook payload the engine reads, as canonical…, svix_headers(), FakeClerkAdmin, Stands in for the Clerk Backend API (D-03): records every publicMetadata.role…, AsyncClient, AsyncSession (+14 more)

### Community 35 - "Marketplace Zod Contracts"
Cohesion: 0.08
Nodes (23): AccountStatus, AvailabilityRange, CohortId, Contact, ContactField, ContactSharing, DayRate, DecisionKind (+15 more)

### Community 36 - "Button Calendar Composer"
Cohesion: 0.16
Nodes (13): Button(), buttonVariants, Calendar(), Composer(), ComposerProps, EmptyTeam(), GapsPanel(), GapsPanelProps (+5 more)

### Community 37 - "Landing Page Screenshot"
Cohesion: 0.15
Nodes (23): Hero side card: Trace a route through BASiX (brief form preview), Visual language: cream background, dark-green accents, serif display headings, small uppercase eyebrow labels, Deterministic / Verifiable section: every recommendation names its rule and its facts (dark rule-evaluation panel), For builders: verified profile + get shown where you are eligible, Hero: The smallest credible route through BASiX, How it works: describe MVP, confirm extracted brief, get MeTTa-decided route with evidence, Landing Page Screen (Stitch batch 2), Three-column footer: Product / Ecosystem / Account (+15 more)

### Community 38 - "Anthropic Adapter Tests"
Cohesion: 0.18
Nodes (18): Anthropic, Response, FakeApi, message_body(), ok(), Any, parametrize, Request (+10 more)

### Community 39 - "shadcn components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 40 - "Web Dev Dependencies"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom, @playwright/test (+14 more)

### Community 41 - "Batch 3 Marketplace Exports"
Cohesion: 0.13
Nodes (22): Context cards: Reusable IP, Cohort and university, Partner, Screen 3.2: Add a showcase project, Licensable as reusable IP toggle, Project form (title, vertical, skills, summary, links, licensable toggle, completion date), Submit for confirmation / Cancel / Back to builder profile, What happens next strip: Submitted, Admin review, Live in graph, Screen 3.4: Admin queue (Confirmation queue), Tabs: Accounts, Credentials, Projects (+14 more)

### Community 42 - "Contracts Package Config"
Cohesion: 0.09
Nodes (21): dependencies, zod, devDependencies, typescript, vitest, exports, ./schema.json, files (+13 more)

### Community 43 - "PRD Risks and Design Source"
Cohesion: 0.14
Nodes (21): PRD milestones (Sprints 000–005), PRD risks (§11), Visual system (tokens, Fraunces / IBM Plex, shadcn/ui, desktop-first 1440px PWA), D-10 Sprint numbering follows the PRD (000 spike … 005 hardening), D-13 Design source is Google Stitch via the prompt pack; exports committed under design/stitch/, D-35 Stitch DESIGN.md block is the source of truth for UI wording and tokens (narrowed by D-36 to tokens), R-01 Nine days to demo with six sprints, R-03 LLM obscures MeTTa's role for judges (+13 more)

### Community 44 - "Sprint 001 Blueprint"
Cohesion: 0.18
Nodes (21): ExtractedBrief (all-optional), LLM boundary test, rulesApplied, Schema parity test (Zod JSON Schema == Pydantic JSON Schema), Sprint 001 — blueprint, AnthropicAdapter, ChatTurn, Conversation orchestrator (app/conversation/orchestrator.py) (+13 more)

### Community 45 - "Anthropic Adapter"
Cohesion: 0.16
Nodes (12): Adopt the adapter's summary only when it names nothing outside the route., AnthropicAdapter, _require_completed(), LlmUnavailable, RuntimeError, The provider timed out, errored, or is not configured; callers fall back to…, outside_entities(), Explanation boundary: an LLM summary may name only entities already in the… (+4 more)

### Community 46 - "Web Runtime Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, class-variance-authority, cn, date-fns, @fontsource/fraunces, @fontsource/ibm-plex-mono, @fontsource/ibm-plex-sans, lucide-react (+12 more)

### Community 47 - "Deterministic Status and Partner Fit"
Cohesion: 0.15
Nodes (19): Non-negotiable 2: Status is deterministic, Builder actor, Founder actor, Judge actor (MeTTa-track evaluator), partner-fit rule (four-hop chain), ADR 0004 (D-07): partner-fit is a four-hop chain through partners-with, Core flow (describe → clarify → review → route → assemble → render → audit), Deterministic route assembly (§5.6) (+11 more)

### Community 48 - "Availability and Gap Rules"
Cohesion: 0.14
Nodes (19): Non-negotiable 8: No secrets in the repo, available-for-brief rule, route-gap rule, compose engine service, ADR 0005 (D-08): Availability qualifies at two days of overlap, GET /health, POST /internal/query (dev-only), Security, privacy and deployment (§8) (+11 more)

### Community 49 - "Voice Intake Screenshot"
Cohesion: 0.16
Nodes (19): Header (Venture Route Beta Edition, How it works, For builders, Sign in), Your Brief So Far Sidebar (3 of 6 Captured), Browser Speech Service Notice (Chrome Transcription), Chloe Spoken Clarifying Question, Demo Data and Cryptographic Verification Note, Deterministic Rule Match Panel (MeTTa Rule, Evaluation Blocked), Venture Route Evaluation Engine Panel (Missing Fields), Find My Route Button (Disabled Until Fields Filled) (+11 more)

### Community 50 - "Nav Footer Landing"
Cohesion: 0.15
Nodes (8): COLUMNS, SiteFooter(), TopNav(), EVIDENCE_FACTS, LandingPage(), SectionProps, STAGES, react-router

### Community 51 - "Batch 4 Dashboard Exports"
Cohesion: 0.15
Nodes (18): What confirming means card, Bids received card, Screen 4.2: Founder dashboard (Your ventures), New brief primary button, Summary tiles: Briefs, Routes, Open requests, Bids received, Bookings, Upcoming interviews card (Africa/Nairobi times), Single-month calendar and time slot buttons, Counter-proposal variant (Counter / Accept) (+10 more)

### Community 52 - "Admin Router"
Cohesion: 0.27
Nodes (16): AdminDecision, Kind, PendingQueue, confirm(), _decide(), _engine(), pending(), AsyncSession (+8 more)

### Community 53 - "Verified Skills and Marketplace Rules"
Cohesion: 0.19
Nodes (17): Non-negotiable 4: Self-described skills are display-only, BASIX admin actor, eligible-builder rule, mode-compatible rule, Self-described skill, verified-for-skill rule, Graph domain model (§5.5 predicates and named rules), Marketplace data and graph projection (§5.8) (+9 more)

### Community 54 - "Node TS Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 55 - "Store Engine and Clerk Admin"
Cohesion: 0.15
Nodes (13): AsyncEngine, HttpClerkAdmin, NullClerkAdmin, Placeholder CLERK_SECRET_KEY (D-26): the local row is updated, Clerk is not…, Clerk Backend API: PATCH /users/{id}/metadata with the server-side secret key., create_session_factory(), create_store_engine(), SessionFactory (+5 more)

### Community 56 - "Batch 1 Route Exports"
Cohesion: 0.18
Nodes (17): Actions: Back to chat, Find my route, Screen 1.2: Brief review (Confirm your brief), Cost strip (Total day rate, Your budget, Headroom), Inline evidence drawer script (openDrawer/closeDrawer, Escape), Header actions: Change brief, Export handoff, Why this route?, Screen 1.3: Route result, feasible, Partial status badge, Screen 1.4: Route result, partial with gaps (+9 more)

### Community 57 - "Composition Root and Snapshot"
Cohesion: 0.16
Nodes (12): Composition root. `create_app` builds the FastAPI app; the engine, the store…, load_seed_briefs(), Path, VentureBrief: validated founder input (PRD §5.3, planning/DOMAIN.md "Core…, build_snapshot(), main(), Generate the offline demo snapshot from the real route service (D-34). Usage…, render() (+4 more)

### Community 58 - "ADRs and Operator Context"
Cohesion: 0.15
Nodes (15): Operator role (Njuguna Njenga), Operator actor, Clerk (auth provider, publicMetadata.role, webhooks), ADR 0002 (D-03): Clerk for authentication and roles, ADR 0007 (D-15): Graph projection is a full rebuild from seed files and confirmed rows, reproject() full-rebuild projection, Neon Postgres store (SQLModel, Alembic, asyncpg, DATABASE_URL), ADR 0008 (D-17): Neon Postgres is the marketplace store (+7 more)

### Community 59 - "Assembler Gap Decisions"
Cohesion: 0.25
Nodes (16): assembler.budget-fit rule, assembler.team-size-fit rule, Gap { category, statement, affected, nextActions }, ADR 0006 (D-09): Gap ownership and deterministic route status, POST /api/route, PRD demo scenarios (§9), PRD open questions (§12), D-09 Gap ownership and deterministic status (MeTTa route-gap vs assembler rules; status a pure function) (+8 more)

### Community 60 - "Conversation Route and LLM Base"
Cohesion: 0.19
Nodes (12): RouteFunction, conversation(), get_orchestrator(), Depends, post, Request, POST /api/conversation: the chat seam (PRD §5.2; Sprint 001, #16). One founder…, Orchestrator (+4 more)

### Community 61 - "Contract Types Glossary"
Cohesion: 0.23
Nodes (15): Evidence type (credential | project | both), Reasoning path { rule, facts, conclusion }, Route, Nine skill IDs (python, ai-metta, ui-ux, frontend, backend, domain-research, mobile, rust, data), Venture brief, ChatResponse type (clarification | route | validation-error), ChatTurn type, §5.2 Main behavioural seam: the conversation endpoint (+7 more)

### Community 62 - "Intake Screen Exports"
Cohesion: 0.16
Nodes (15): Availability two-month range calendar, Brief form grid (Title, Vertical, Required skills, Team size, Availability, Delivery mode, Location, Daily budget, Reusable IP), Daily budget validation error state, Chat thread: Describe your MVP, Founder composer (Send, Use the form instead), Find my route button (disabled until fields filled), Screen 1.1: Founder intake, Scenario chips: Health pilot, Agri marketplace, Constrained brief (+7 more)

### Community 63 - "Evidence and Demo Data UI"
Cohesion: 0.17
Nodes (15): Rules applied dark footer strip, Team builder cards (Amina Otieno, Tendai Moyo, Wanjiru Kamau), Gaps panel (route-gap, Affected: Mobile, next actions with Apply), Source fact groups (Amina covers Python, reuse-fit, partner-fit multi-hop), Evidence, not vibes dark section, Read-only plain-text handoff block (VENTURE ROUTE HANDOFF), Expanded credential detail (cred-rust-311 fact preview, Confirm credential), Pending accounts table (Confirm / Reject per row) (+7 more)

### Community 64 - "JWKS Cache"
Cohesion: 0.17
Nodes (8): Fetch, PyJWK, fetch_jwks_over_http(), _fetch(), JwksCache, Any, Public keys by `kid`. One fetch at start-up, one refetch on a miss, never on a…, Fetch the JWKS; False when there is nothing to fetch or the fetch failed.

### Community 65 - "Contracts TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, module, moduleResolution, noUncheckedIndexedAccess, outDir (+6 more)

### Community 66 - "Route Zod Contracts"
Cohesion: 0.14
Nodes (12): EvidenceType, Gap, GapCategory, LookupName, ReasoningPath, ReusableIp, RouteBuilder, RouteCohort (+4 more)

### Community 67 - "Schema Parity Test"
Cohesion: 0.15
Nodes (13): AdminDecision, BuilderProfile, Credential, CredentialInput, PendingQueue, ProfileInput, Project, ProjectInput (+5 more)

### Community 68 - "Clerk Session Verification"
Cohesion: 0.21
Nodes (12): AuthError, _bearer_token(), current_user(), AsyncSession, Depends, Exception, Request, Clerk session verification and role gating (D-03, spec #35 §Authentication). -… (+4 more)

### Community 69 - "Scenario API Tests"
Cohesion: 0.35
Nodes (13): Any, parametrize, TestClient, Seam: HTTP POST /api/route and POST /api/conversation, the five DOMAIN.md…, seed_briefs(), test_agri_cost_ordering_beats_evidence_ordering(), test_budget_challenge_gap_is_exactly_d22(), test_constrained_brief_fabricates_no_mobile_builder() (+5 more)

### Community 70 - "Playwright E2E Suite"
Cohesion: 0.21
Nodes (7): builderIds(), builderNames(), routeScenario(), EXPECTED, ENGINE_DIR, HERE, @playwright/test

### Community 71 - "Brief Zod Contracts"
Cohesion: 0.15
Nodes (12): BriefTitle, DailyBudget, DeliveryMode, IsoDate, Location, PartialBriefInput, RequiredSkills, SkillId (+4 more)

### Community 72 - "Graph Projection"
Cohesion: 0.19
Nodes (12): AsyncSession, Graph projection (D-15, spec #35 §Projection): confirmed marketplace rows →…, One fact per line, seed predicates only: no new predicate and no new rule name., Rebuild the space from seed facts plus confirmed rows; returns the projected…, render_program(), reproject(), short(), allocate_builder_id() (+4 more)

### Community 73 - "Stitch Export Process"
Cohesion: 0.18
Nodes (12): src/main.tsx module entry, Venture Route web shell (index.html), Stitch-added Deterministic rule match card and attested session label (drop in React), Refresh-export rule: never hand-edit index.html, D-36: Stitch export wins over screenshot, Stitch exports README, Stitch project: Venture Route Design System (14240170250148839149), Batch 5: Chloe voice intake (Sprint 006, D-38) (+4 more)

### Community 74 - "Root Package Config"
Cohesion: 0.17
Nodes (11): devDependencies, turbo, name, packageManager, private, scripts, build, lint (+3 more)

### Community 75 - "Chat Zod Contracts"
Cohesion: 0.17
Nodes (11): BriefField, PartialBrief, VentureBrief, ChatResponse, ChatTurn, ChatTurnInput, ClarificationResponse, MAX_MESSAGE_LENGTH (+3 more)

### Community 76 - "Conversation API Tests"
Cohesion: 0.29
Nodes (11): outage_client(), Any, fixture, TestClient, Seam: HTTP POST /api/conversation (Sprint 001, #16, D-19). Runs with…, seed_brief(), test_confirmed_brief_routes_and_equals_the_form_path_byte_for_byte(), test_invalid_merged_brief_is_a_validation_error_response() (+3 more)

### Community 77 - "Brief Panel and Context Cards"
Cohesion: 0.25
Nodes (7): DemoDataPill(), BriefPanel(), BriefPanelProps, ContextCards(), ContextCardsProps, missingFields(), briefChips()

### Community 78 - "Engine Query Screenshot"
Cohesion: 0.24
Nodes (11): Engine Query Response Screenshot, admin-basix Confirmation, brief-constrained-01, Credential Evidence (cred-rust-150), eligible-builder Rule, Explanation Path (rule + facts + conclusion), S-expression Facts (MeTTa-style atoms), Query Response Schema (briefId, eligible, reuse, partners, gaps) (+3 more)

### Community 79 - "Turbo Tasks"
Cohesion: 0.18
Nodes (10): dependsOn, outputs, $schema, tasks, build, lint, test, typecheck (+2 more)

### Community 80 - "Badge and Toggle"
Cohesion: 0.29
Nodes (7): Badge(), badgeVariants, Toggle(), toggleVariants, class-variance-authority, cn, radix-ui

### Community 81 - "Sign-in and Landing Exports"
Cohesion: 0.24
Nodes (10): For builders: Verified profile, Bid where you are eligible, Hero: The smallest credible route through BASIX, Screen 2.1: Landing page, Route my venture primary CTA, Caption: accounts confirmed by a BASIX admin before appearing in routes or bids, Clerk <SignIn /> component placeholder, Role selector cards: I am a founder / I am a builder, Screen 2.3: Sign in (+2 more)

### Community 82 - "Internal Query Tests"
Cohesion: 0.31
Nodes (9): dev_client(), fixture, TestClient, Seam: HTTP POST /internal/query (D-19), dev-only behind ENGINE_DEV_QUERY., test_health_reports_all_seven_named_rules(), test_internal_query_gaps_are_camel_case_on_the_wire(), test_internal_query_is_absent_unless_enabled(), test_internal_query_returns_typed_results_for_a_seed_brief() (+1 more)

### Community 83 - "Route API Tests"
Cohesion: 0.33
Nodes (9): Any, parametrize, TestClient, Seam: HTTP POST /api/route (form path) and GET /api/scenarios (Sprint 001, #15,…, seed_brief(), test_route_form_path_health_pilot_is_feasible_on_the_wire(), test_route_rejects_a_non_json_body_with_a_validation_error(), test_route_validation_errors_are_field_specific_and_never_a_route() (+1 more)

### Community 85 - "Demo Data Principle"
Cohesion: 0.25
Nodes (8): Non-negotiable 5: Demo data is labelled, Non-negotiable 6: Gaps before team cards, Demo data label, reuse-fit rule, GET /api/scenarios, Design principles, Scenario brief-health-01 (Health pilot, feasible), R-07 Synthetic data mistaken for real

### Community 86 - "LLM Boundary"
Cohesion: 0.36
Nodes (8): Non-negotiable 3: LLM boundary enforced in code, ADR 0003 (D-06): Anthropic SDK behind an LlmAdapter interface, LlmAdapter interface (anthropic SDK, claude-opus-5, structured output), NullAdapter (no-key fallback), LLM safety boundary (§5.7), DOMAIN LLM boundary, LLM system instruction (verbatim, must appear in code), Sprint 001 hard rules (LLM never sets status / receives facts / names outside entity; pure assembler; contracts first)

### Community 87 - "Web Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, e2e, lint, preview, test, typecheck

### Community 89 - "Alembic Migration 0001"
Cohesion: 0.39
Nodes (6): Column, _demo_columns(), Any, CheckConstraint, upgrade(), _uuid_pk()

### Community 90 - "Test JWT Signing"
Cohesion: 0.39
Nodes (7): generate_test_keys(), Test JWKS and JWT signing for the Clerk seam (D-03, D-19). A fresh RSA key pair…, sign_jwt(), SigningKeys, _bearer(), test_keys(), timedelta

### Community 91 - "Engine Error Tests"
Cohesion: 0.50
Nodes (7): Path, EngineError and the fails-not-skips guarantee (requirements.md item 4,…, _seed_copy(), test_missing_seed_file_raises_engine_error(), test_rules_loaded_counts_only_rules_present_in_the_space(), test_runtime_tests_fail_rather_than_skip_without_hyperon(), test_unparseable_rule_output_raises_engine_error()

### Community 92 - "Alembic Environment"
Cohesion: 0.43
Nodes (6): Connection, do_run_migrations(), Alembic environment: async migrations over asyncpg (D-17). URL resolution,…, resolve_url(), run_migrations_offline(), run_migrations_online()

### Community 93 - "Health Endpoint Facts"
Cohesion: 0.43
Nodes (7): Loaded facts and rules knowledge base, GET /health endpoint, Health response body (status, facts_loaded, rules_loaded, hyperon_version, demo_today), Hyperon 0.2.10 runtime, /openapi.json schema, Engine Health Swagger UI Screenshot, Venture Route engine (FastAPI app, v0.0.1, OAS 3.1)

### Community 94 - "Contracts Build Config"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ./tsconfig.json

### Community 95 - "Schema Tests"
Cohesion: 0.29
Nodes (6): Any, parametrize, Seam: Zod <-> Pydantic JSON Schema parity, engine side (Sprint 001, D-19). The…, test_brief_rejects_each_invalid_case_with_a_field_specific_message(), test_committed_schema_json_equals_fresh_pydantic_export(), test_export_covers_the_shared_contracts()

### Community 96 - "App Icons"
Cohesion: 0.53
Nodes (6): Favicon SVG (purple bolt mark, Astro starter default), PWA icon 192 (dark green rounded square, mint diagonal route with three cream waypoints), PWA icon 512 (dark green rounded square, mint diagonal route with three cream waypoints), PWA maskable icon 512 (full-bleed dark green square, route mark padded into safe zone), SVG icon sprite (bluesky, discord, documentation, github, social, x symbols), Venture Route app mark (diagonal route with three waypoints, green and cream palette)

### Community 97 - "Web TS References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 98 - "Sonner Toaster"
Cohesion: 0.40
Nodes (3): lucide-react, next-themes, sonner

### Community 99 - "Handoff Export Embellishments"
Cohesion: 0.40
Nodes (5): Stitch-added Evidence Chain / registry proofs drawer (not in prompt), Copy to clipboard / Download .txt actions, Stitch-added Ledger Attestation / Verification Details cards (drop in React), Screen 2.2: Venture handoff, MCP curl workaround for generate_screen_from_text timeout

### Community 100 - "Health Tests"
Cohesion: 0.40
Nodes (3): TestClient, Seam: HTTP GET /health (D-19). Real runtime behind FastAPI's lifespan., test_health_reports_loaded_graph_and_runtime_version()

## Ambiguous Edges - Review These
- `Sprint 001 hard rules (LLM never sets status / receives facts / names outside entity; pure assembler; contracts first)` → `D-26 Secrets arrive only through the git-ignored .env; missing key means NullAdapter, never a blocker`  [AMBIGUOUS]
  planning/sprints/001-routing-core/handoff-prompt.md · relation: conceptually_related_to
- `Synthetic test brief quick-load chips (Load domain: Health pilot, Agri marketplace, Constrained brief)` → `Route Result Partial Screen (Your route through BASIX, Partial badge, gap with relief options, unfilled seat, evidence chain drawer)`  [AMBIGUOUS]
  design/stitch/batch-1/founder-intake/screenshot.jpg · relation: conceptually_related_to
- `Clerk SignIn component slot: Google OAuth, passkey / hardware token, email return link` → `Registry-node breadcrumb and ledger-version chrome (Registry Node 01 > BASIX Edition 2024.1 > Signer Ready)`  [AMBIGUOUS]
  design/stitch/batch-2/sign-in/screenshot.jpg · relation: conceptually_related_to
- `Registry-node breadcrumb and ledger-version chrome (Registry Node 01 > BASIX Edition 2024.1 > Signer Ready)` → `Ledger attestation panel: anchor block, evaluator engine MeTTa-Core, SHA-256 digest`  [AMBIGUOUS]
  design/stitch/batch-2/venture-handoff/screenshot.png · relation: semantically_similar_to
- `Ledger immutability note (confirmations are irreversible attestations)` → `Rules applied dark ticker strip (certified-for-skill, mode-compatible, available-for-brief, eligible-builder)`  [AMBIGUOUS]
  design/stitch/batch-3/candidate-profile/screenshot.png · relation: conceptually_related_to
- `Booking Summary Card (candidate, proposed time, platform, commercial reference, Propose time CTA)` → `Day Rate Field (USD / day, matches founder posting rate)`  [AMBIGUOUS]
  design/stitch/batch-4/requests-board/screenshot.jpg · relation: shares_data_with
- `Founder Transcript Card (Attested Voice Session)` → `Preset Scenario Chips (Health pilot, Agri marketplace, Constrained brief)`  [AMBIGUOUS]
  design/stitch/batch-5/founder-intake-voice/screenshot.png · relation: shares_data_with
- `Favicon SVG (purple bolt mark, Astro starter default)` → `Venture Route app mark (diagonal route with three waypoints, green and cream palette)`  [AMBIGUOUS]
  apps/web/public/favicon.svg · relation: conceptually_related_to

## Knowledge Gaps
- **340 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+335 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 685 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Sprint 001 hard rules (LLM never sets status / receives facts / names outside entity; pure assembler; contracts first)` and `D-26 Secrets arrive only through the git-ignored .env; missing key means NullAdapter, never a blocker`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Synthetic test brief quick-load chips (Load domain: Health pilot, Agri marketplace, Constrained brief)` and `Route Result Partial Screen (Your route through BASIX, Partial badge, gap with relief options, unfilled seat, evidence chain drawer)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Clerk SignIn component slot: Google OAuth, passkey / hardware token, email return link` and `Registry-node breadcrumb and ledger-version chrome (Registry Node 01 > BASIX Edition 2024.1 > Signer Ready)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Registry-node breadcrumb and ledger-version chrome (Registry Node 01 > BASIX Edition 2024.1 > Signer Ready)` and `Ledger attestation panel: anchor block, evaluator engine MeTTa-Core, SHA-256 digest`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Ledger immutability note (confirmations are irreversible attestations)` and `Rules applied dark ticker strip (certified-for-skill, mode-compatible, available-for-brief, eligible-builder)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Booking Summary Card (candidate, proposed time, platform, commercial reference, Propose time CTA)` and `Day Rate Field (USD / day, matches founder posting rate)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Founder Transcript Card (Attested Voice Session)` and `Preset Scenario Chips (Health pilot, Agri marketplace, Constrained brief)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._