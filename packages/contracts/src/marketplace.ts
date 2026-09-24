/**
 * Marketplace contracts (Sprint 003, spec #35 §Marketplace API).
 *
 * Mirrors `services/engine/app/marketplace/schemas.py`; the parity test keeps the two equal.
 * One skill shape everywhere: `{ id, name, status, evidence }`, where a self-described skill is
 * display only and never verified (CONTEXT.md "Self-described skill").
 */
import { z } from "zod";

import { DailyBudget, DeliveryMode, IsoDate, Location, SkillId, VentureBrief, Vertical } from "./brief.js";
import { ReasoningPath, RouteStatus, UsdPerDay } from "./route.js";

export const Evidence = z.enum(["credential", "project", "both"]);
export type Evidence = z.infer<typeof Evidence>;

export const SkillStatus = z.enum(["verified", "self-described"]);
export type SkillStatus = z.infer<typeof SkillStatus>;

export const AccountStatus = z.enum(["pending", "confirmed", "rejected"]);
export type AccountStatus = z.infer<typeof AccountStatus>;

/** The two roles a user may choose at sign-up; admin comes only from ADMIN_EMAILS (D-03). */
export const UserRole = z.enum(["founder", "builder"]);
export type UserRole = z.infer<typeof UserRole>;

/**
 * Sprint 005a (spec #86): a showcase entry's own review status, and which kind of skill a
 * `GET /api/showcase?skill=` filter matched. Declared up here, with the other top-level enums,
 * so the admin queue row shapes below (`PendingShowcase`/`DecidedShowcase`) can use them.
 */
export const MatchedSkillKind = z.enum(["demonstrated", "verified", "self-described"]);
export type MatchedSkillKind = z.infer<typeof MatchedSkillKind>;

export const ShowcaseStatus = z.enum(["none", "pending", "confirmed", "rejected"]);
export type ShowcaseStatus = z.infer<typeof ShowcaseStatus>;

export const DisplayName = z.string().min(1).max(80);
export const Headline = z.string().max(200);
export const ContactField = z.string().max(100);
export const CohortId = z.string().min(1).max(40);
/** Integer USD per day (D-16), same bounds as the brief's daily budget. */
export const DayRate = DailyBudget;

/**
 * Sprint 005a (spec #86, D-43/D-52): showcase description, plain link strings (the `https://` /
 * host / YouTube rules live in the endpoints' links module, #89, not in these wire shapes), one
 * free-text skill label shared by `skillSet`, `suggestedSkills` and résumé suggestions (`.trim()`
 * runs before `.min(1)`, so a whitespace-only entry is rejected, not silently accepted as blank),
 * and the 11-character YouTube video id the endpoints parse out of `pitchVideoUrl` (#89).
 */
export const ShowcaseDescription = z.string().max(1000);
export const ShowcaseUrl = z.string().max(500);
export const SkillSetEntry = z.string().trim().min(1).max(40);
export const PitchVideoId = z.string().length(11);

export const RoleChoice = z.strictObject({ role: UserRole });
export type RoleChoice = z.infer<typeof RoleChoice>;

export const RoleResponse = z.strictObject({
  clerkId: z.string(),
  role: UserRole,
  confirmed: z.boolean(),
});
export type RoleResponse = z.infer<typeof RoleResponse>;

export const DeliveryModes = z.strictObject({
  remote: z.boolean(),
  hybrid: z.boolean(),
  onSite: z.boolean(),
});
export type DeliveryModes = z.infer<typeof DeliveryModes>;

export const ContactSharing = z.strictObject({
  email: z.boolean(),
  phone: z.boolean(),
  linkedin: z.boolean(),
});
export type ContactSharing = z.infer<typeof ContactSharing>;

export const AvailabilityRange = z.strictObject({
  start: IsoDate,
  end: IsoDate,
});
export type AvailabilityRange = z.infer<typeof AvailabilityRange>;

export const ProfileInput = z.strictObject({
  displayName: DisplayName,
  headline: Headline.default(""),
  cohortId: CohortId.nullable().default(null),
  location: Location,
  dayRate: DayRate,
  modes: DeliveryModes,
  selfDescribedSkills: z.array(SkillId).max(9),
  phone: ContactField.nullable().default(null),
  linkedin: ContactField.nullable().default(null),
  sharing: ContactSharing,
  availability: z.array(AvailabilityRange).max(12),
  // Sprint 005a (spec #86, D-43/D-52): free-text skill chips, separate from the nine-skill
  // `selfDescribedSkills` above, which stays unchanged. `skillSet` is picked by hand;
  // `suggestedSkills` holds résumé chips the builder accepted one at a time (D-50).
  skillSet: z.array(SkillSetEntry).max(20).default([]),
  suggestedSkills: z.array(SkillSetEntry).max(20).default([]),
  // Public profile links, shown on the Showcase regardless of the `sharing` toggle above.
  githubUrl: ShowcaseUrl.nullable().default(null),
  linkedinUrl: ShowcaseUrl.nullable().default(null),
});
export type ProfileInput = z.infer<typeof ProfileInput>;
export type ProfileInputInput = z.input<typeof ProfileInput>;

export const ProfileSkill = z.strictObject({
  id: SkillId,
  name: z.string(),
  status: SkillStatus,
  evidence: Evidence.nullable().default(null),
});
export type ProfileSkill = z.infer<typeof ProfileSkill>;

export const Contact = z.strictObject({
  email: z.string(),
  phone: z.string().nullable().default(null),
  linkedin: z.string().nullable().default(null),
});
export type Contact = z.infer<typeof Contact>;

export const BuilderProfile = z.strictObject({
  builderId: z.string(),
  displayName: DisplayName,
  headline: Headline,
  cohortId: CohortId.nullable().default(null),
  location: Location,
  dayRate: DayRate,
  modes: DeliveryModes,
  selfDescribedSkills: z.array(SkillId),
  contact: Contact,
  sharing: ContactSharing,
  availability: z.array(AvailabilityRange),
  skills: z.array(ProfileSkill),
  accountStatus: AccountStatus,
  confirmed: z.boolean(),
  skillSet: z.array(SkillSetEntry).max(20).default([]),
  suggestedSkills: z.array(SkillSetEntry).max(20).default([]),
  githubUrl: ShowcaseUrl.nullable().default(null),
  linkedinUrl: ShowcaseUrl.nullable().default(null),
  /** Every record in this release is demo data (AGENTS.md non-negotiable 5). */
  demoData: z.boolean().default(true),
});
export type BuilderProfile = z.infer<typeof BuilderProfile>;

/** Proof a builder submits; pending until a BASIX admin confirms it (DOMAIN.md §Marketplace). */
export const Title = z.string().min(1).max(120);
export const Issuer = z.string().min(1).max(120);

/**
 * Sprint 005a (spec #86, story 15): a certification outside the nine-skill vocabulary has no
 * `skillId`; it stays display-only and never produces a `proves` fact (D-52). Existing clients
 * that always send `skillId` keep working unchanged. `skillId` keeps `.default(null)`: the
 * builder's skill picker already exists, so an explicit `null` for "no vocabulary skill" is
 * meaningful. `issuedOn`/`credentialUrl` have no picker yet (#99), so they are `.optional()`
 * with no default: unset fields are simply absent from the parsed body, not sent as noise
 * (W0 integration fix).
 */
export const CredentialInput = z.strictObject({
  title: Title,
  issuer: Issuer,
  skillId: SkillId.nullable().default(null),
  issuedOn: IsoDate.nullable().optional(),
  credentialUrl: ShowcaseUrl.nullable().optional(),
});
export type CredentialInput = z.infer<typeof CredentialInput>;
export type CredentialInputInput = z.input<typeof CredentialInput>;

export const Credential = z.strictObject({
  id: z.string(),
  title: Title,
  issuer: Issuer,
  skillId: SkillId.nullable().default(null),
  issuedOn: IsoDate.nullable().default(null),
  credentialUrl: ShowcaseUrl.nullable().default(null),
  status: AccountStatus,
  demoData: z.boolean().default(true),
});
export type Credential = z.infer<typeof Credential>;

export const ProjectInput = z.strictObject({
  title: Title,
  vertical: Vertical,
  licensable: z.boolean(),
  completedOn: IsoDate,
  skillIds: z.array(SkillId).min(1).max(5),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export const Project = z.strictObject({
  id: z.string(),
  title: Title,
  vertical: Vertical,
  licensable: z.boolean(),
  completedOn: IsoDate,
  skillIds: z.array(SkillId).min(1).max(5),
  status: AccountStatus,
  demoData: z.boolean().default(true),
});
export type Project = z.infer<typeof Project>;

/** Admin queue (spec #35 §Admin): pending accounts, credentials and projects. */
export const IsoDateTime = z.iso.datetime({ offset: true });

export const PendingAccount = z.strictObject({
  id: z.string(),
  clerkId: z.string(),
  email: z.string(),
  role: UserRole.nullable().default(null),
  builderId: z.string().nullable().default(null),
  displayName: z.string().nullable().default(null),
  cohortId: z.string().nullable().default(null),
  submittedAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type PendingAccount = z.infer<typeof PendingAccount>;

/**
 * Sprint 005a (spec #86 story 55): a skill-less certification reaches this same queue, so
 * `skillId` must be nullable here too, or `GET /api/admin/pending` 500s on it.
 */
export const PendingCredential = z.strictObject({
  id: z.string(),
  builderId: z.string(),
  displayName: z.string(),
  title: Title,
  issuer: Issuer,
  skillId: SkillId.nullable().default(null),
  issuedOn: IsoDate.nullable().default(null),
  credentialUrl: ShowcaseUrl.nullable().default(null),
  submittedAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type PendingCredential = z.infer<typeof PendingCredential>;

export const PendingProject = z.strictObject({
  id: z.string(),
  builderId: z.string(),
  displayName: z.string(),
  title: Title,
  vertical: Vertical,
  licensable: z.boolean(),
  completedOn: IsoDate,
  skillIds: z.array(SkillId),
  submittedAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type PendingProject = z.infer<typeof PendingProject>;

/**
 * Admin card preview (spec #86 story 48): the same fields the public `ShowcaseCard` shows, plus
 * the flags that drive the "Project not yet confirmed" / "Account not confirmed" warnings
 * (story 49) and the showcase entry's own review status.
 */
export const PendingShowcase = z.strictObject({
  id: z.string(),
  builderId: z.string(),
  displayName: z.string(),
  cohortId: CohortId.nullable().default(null),
  title: Title,
  description: ShowcaseDescription,
  vertical: Vertical,
  licensable: z.boolean(),
  skillIds: z.array(SkillId).min(1).max(5),
  liveUrl: ShowcaseUrl.nullable().default(null),
  demoUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoUrl: ShowcaseUrl.nullable().default(null),
  pitchDeckUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoId: PitchVideoId.nullable().default(null),
  showcaseStatus: ShowcaseStatus,
  /** "Project not yet confirmed" / "Account not confirmed" (story 49). */
  projectStatus: AccountStatus,
  accountConfirmed: z.boolean(),
  submittedAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type PendingShowcase = z.infer<typeof PendingShowcase>;

export const PendingQueue = z.strictObject({
  accounts: z.array(PendingAccount),
  credentials: z.array(PendingCredential),
  projects: z.array(PendingProject),
  // Optional and defaulted so a client built before the showcase admin kind (#103) shipped still
  // validates this response.
  showcase: z.array(PendingShowcase).default([]),
});
export type PendingQueue = z.infer<typeof PendingQueue>;

export const DecisionStatus = z.enum(["confirmed", "rejected"]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

/**
 * Decided list (spec #35 story 24, #49): the same rows as the pending queue once an admin has
 * confirmed or rejected them, with the latest decision and its timestamp so it can be reversed
 * through the opposite endpoint. Admin accounts never appear.
 */
export const DecidedAccount = PendingAccount.extend({ status: DecisionStatus, decidedAt: IsoDateTime });
export type DecidedAccount = z.infer<typeof DecidedAccount>;

export const DecidedCredential = PendingCredential.extend({ status: DecisionStatus, decidedAt: IsoDateTime });
export type DecidedCredential = z.infer<typeof DecidedCredential>;

export const DecidedProject = PendingProject.extend({ status: DecisionStatus, decidedAt: IsoDateTime });
export type DecidedProject = z.infer<typeof DecidedProject>;

export const DecidedShowcase = PendingShowcase.extend({ status: DecisionStatus, decidedAt: IsoDateTime });
export type DecidedShowcase = z.infer<typeof DecidedShowcase>;

export const DecidedQueue = z.strictObject({
  accounts: z.array(DecidedAccount),
  credentials: z.array(DecidedCredential),
  projects: z.array(DecidedProject),
  showcase: z.array(DecidedShowcase).default([]),
});
export type DecidedQueue = z.infer<typeof DecidedQueue>;

/** Every kind an admin decides on; `showcase` (#103) has its own tab in the admin UI (#106). */
export const AdminDecisionKind = z.enum(["account", "credential", "project", "showcase"]);
export type AdminDecisionKind = z.infer<typeof AdminDecisionKind>;

export const AdminDecision = z.strictObject({
  id: z.string(),
  kind: AdminDecisionKind,
  status: z.enum(["confirmed", "rejected"]),
  /** Atoms projected from confirmed rows after this decision (D-15). */
  projectedRows: z.int().min(0),
});
export type AdminDecision = z.infer<typeof AdminDecision>;

/** Candidate view (spec #35 §Marketplace API, #43): a confirmed builder as a founder sees them. */
export const SharedContact = z.strictObject({
  /** Only the keys whose sharing toggle is on are sent; an unshared key is absent, never null. */
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  linkedin: z.string().nullable().default(null),
});
export type SharedContact = z.infer<typeof SharedContact>;

export const Candidate = z.strictObject({
  builderId: z.string(),
  displayName: DisplayName,
  headline: Headline,
  cohortId: CohortId.nullable().default(null),
  location: Location,
  dayRate: DayRate,
  modes: DeliveryModes,
  availability: z.array(AvailabilityRange),
  skills: z.array(ProfileSkill),
  /** Confirmed projects only; pending and rejected proof never reaches a founder. */
  projects: z.array(Project),
  contact: SharedContact,
  confirmed: z.boolean(),
  demoData: z.boolean().default(true),
});
export type Candidate = z.infer<typeof Candidate>;

/**
 * Sprint 004 (spec #52 §HTTP API, #54): requests, bids, bookings, eligibility, dashboard.
 * Money is integer USD per day (D-16); `proposedStart` is ISO 8601 with offset in UTC and
 * `proposedStartLocal` the same instant rendered by the engine in Africa/Nairobi.
 */
export const RequestStatus = z.enum(["open", "closed"]);
export type RequestStatus = z.infer<typeof RequestStatus>;

/** One value this sprint; a literal, so the JSON Schema is the `const` the Pydantic mirror emits. */
export const BidStatus = z.literal("submitted");
export type BidStatus = z.infer<typeof BidStatus>;

export const BookingState = z.enum(["proposed", "accepted", "countered", "confirmed"]);
export type BookingState = z.infer<typeof BookingState>;

export const BookingAction = z.enum(["propose", "accept", "counter", "confirm"]);
export type BookingAction = z.infer<typeof BookingAction>;

export const BookingActor = z.enum(["founder", "builder"]);
export type BookingActor = z.infer<typeof BookingActor>;

/** 30 or 45 minutes; `meta` keeps the JSON Schema `type: integer` the Pydantic literal emits. */
export const DurationMin = z.literal([30, 45]).meta({ type: "integer" });
export type DurationMin = z.infer<typeof DurationMin>;

export const BidMessage = z.string().max(1000);
export const BookingNote = z.string().max(500);
export const Count = z.int().min(0);

/** What the founder saw when publishing; display-only, never an input to eligibility. */
export const RouteSnapshot = z.strictObject({
  status: RouteStatus,
  totalDailyRate: UsdPerDay,
  builderIds: z.array(z.string()),
});
export type RouteSnapshot = z.infer<typeof RouteSnapshot>;

export const RequestCreate = z.strictObject({
  brief: VentureBrief,
  route: RouteSnapshot,
});
export type RequestCreate = z.infer<typeof RequestCreate>;
export type RequestCreateInput = z.input<typeof RequestCreate>;

/** The engine's verdict for one builder on one brief: `eligible-builder` witnesses only. */
export const Eligibility = z.strictObject({
  eligible: z.boolean(),
  skills: z.array(SkillId),
  path: ReasoningPath.nullable().default(null),
  reason: z.string().nullable().default(null),
});
export type Eligibility = z.infer<typeof Eligibility>;

export const Request = z.strictObject({
  id: z.string(),
  founderId: z.string(),
  brief: VentureBrief,
  route: RouteSnapshot,
  title: z.string(),
  vertical: Vertical,
  deliveryMode: DeliveryMode,
  availabilityStart: IsoDate,
  availabilityEnd: IsoDate,
  dailyBudget: DailyBudget,
  routeStatus: RouteStatus,
  status: RequestStatus,
  closedAt: IsoDateTime.nullable().default(null),
  createdAt: IsoDateTime,
  /** Present on the builder's list only: the engine's verdict for the signed-in builder. */
  eligibility: Eligibility.nullable().default(null),
  demoData: z.boolean().default(true),
});
export type Request = z.infer<typeof Request>;

export const BidCreate = z.strictObject({
  dayRate: DayRate,
  message: BidMessage.default(""),
});
export type BidCreate = z.infer<typeof BidCreate>;
export type BidCreateInput = z.input<typeof BidCreate>;

export const Bid = z.strictObject({
  id: z.string(),
  requestId: z.string(),
  requestTitle: z.string(),
  requestStatus: RequestStatus,
  builderId: z.string(),
  displayName: z.string(),
  dayRate: DayRate,
  message: BidMessage,
  /** The skills `eligible-builder` held for, and the first witness the engine returned. */
  eligibleSkills: z.array(SkillId),
  path: ReasoningPath,
  status: BidStatus,
  createdAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type Bid = z.infer<typeof Bid>;

export const BookingProposal = z.strictObject({
  proposedStart: IsoDateTime,
  durationMin: DurationMin,
  note: BookingNote.default(""),
});
export type BookingProposal = z.infer<typeof BookingProposal>;
export type BookingProposalInput = z.input<typeof BookingProposal>;

export const BookingCreate = z.strictObject({
  ...BookingProposal.shape,
  builderId: z.string(),
  requestId: z.string().nullable().default(null),
});
export type BookingCreate = z.infer<typeof BookingCreate>;
export type BookingCreateInput = z.input<typeof BookingCreate>;

export const BookingHistoryEntry = z.strictObject({
  action: BookingAction,
  actor: BookingActor,
  /** The state after the transition. */
  state: BookingState,
  proposedStart: IsoDateTime,
  proposedStartLocal: z.string(),
  durationMin: DurationMin,
  note: BookingNote,
  at: IsoDateTime,
});
export type BookingHistoryEntry = z.infer<typeof BookingHistoryEntry>;

export const Booking = z.strictObject({
  id: z.string(),
  requestId: z.string().nullable().default(null),
  requestTitle: z.string().nullable().default(null),
  founderId: z.string(),
  builderId: z.string(),
  displayName: z.string(),
  state: BookingState,
  proposedStart: IsoDateTime,
  proposedStartLocal: z.string(),
  durationMin: DurationMin,
  note: BookingNote,
  history: z.array(BookingHistoryEntry),
  createdAt: IsoDateTime,
  demoData: z.boolean().default(true),
});
export type Booking = z.infer<typeof Booking>;

export const RouteCounts = z.strictObject({
  feasible: Count,
  partial: Count,
  infeasible: Count,
});
export type RouteCounts = z.infer<typeof RouteCounts>;

export const DashboardCounts = z.strictObject({
  briefs: Count,
  routes: RouteCounts,
  openRequests: Count,
  bidsReceived: Count,
  bookings: Count,
});
export type DashboardCounts = z.infer<typeof DashboardCounts>;

export const Dashboard = z.strictObject({
  counts: DashboardCounts,
  requests: z.array(Request),
  bidsReceived: z.array(Bid),
  upcomingBookings: z.array(Booking),
});
export type Dashboard = z.infer<typeof Dashboard>;

/**
 * Sprint 005a (spec #86 §API contracts, §Web): Builder Showcase and skill suggestions.
 * Public reads never carry email, phone, location, day rate or availability (D-43). Link fields
 * are plain strings capped at 500 chars; `https://` / host / YouTube rules are enforced by the
 * endpoints through the links module (#89), not by these wire shapes. `MatchedSkillKind` and
 * `ShowcaseStatus` are declared with the other top-level enums above.
 */

/**
 * Which of a builder's skills matched a `GET /api/showcase?skill=` filter, and how. `skill`
 * accepts a vocabulary id (e.g. `python`) or a free-text `skillSet`/`suggestedSkills` label; a
 * self-described match's `id` is null and `label` carries the free text as typed.
 */
export const MatchedSkill = z.strictObject({
  id: SkillId.nullable().default(null),
  label: z.string(),
  kind: MatchedSkillKind,
});
export type MatchedSkill = z.infer<typeof MatchedSkill>;

/** One gallery tile (spec #86 story 37): `GET /api/showcase` returns these in `items`. */
export const ShowcaseCard = z.strictObject({
  id: z.string(),
  title: Title,
  builderId: z.string(),
  displayName: DisplayName,
  cohortId: CohortId.nullable().default(null),
  vertical: Vertical,
  licensable: z.boolean(),
  description: ShowcaseDescription,
  skillIds: z.array(SkillId).min(1).max(5),
  /** Present only when the request carried `?skill=`: which kind of skill matched (story 32). */
  matchedSkill: MatchedSkill.nullable().default(null),
  liveUrl: ShowcaseUrl.nullable().default(null),
  demoUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoUrl: ShowcaseUrl.nullable().default(null),
  pitchDeckUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoId: PitchVideoId.nullable().default(null),
  demoData: z.boolean().default(true),
});
export type ShowcaseCard = z.infer<typeof ShowcaseCard>;

export const ShowcasePage = z.strictObject({
  items: z.array(ShowcaseCard),
  total: Count,
});
export type ShowcasePage = z.infer<typeof ShowcasePage>;

/**
 * The builder panel (story 42): verified skills, self-described chips, certifications and public
 * profile links only; never email, phone, location, day rate or availability (D-43).
 */
export const ShowcaseBuilder = z.strictObject({
  builderId: z.string(),
  displayName: DisplayName,
  cohortId: CohortId.nullable().default(null),
  verifiedSkills: z.array(ProfileSkill),
  // `skillSet` + `suggestedSkills` combined, labelled "Self-described", never "verified". Not
  // `BuilderProfile.selfDescribedSkills`, which stays the nine-vocabulary field, unchanged.
  skillSet: z.array(SkillSetEntry),
  certifications: z.array(Credential),
  githubUrl: ShowcaseUrl.nullable().default(null),
  linkedinUrl: ShowcaseUrl.nullable().default(null),
});
export type ShowcaseBuilder = z.infer<typeof ShowcaseBuilder>;

/** `GET /api/showcase/{projectId}` (story 41-42); a hidden or missing entry answers 404. */
export const ShowcaseDetail = z.strictObject({
  id: z.string(),
  title: Title,
  vertical: Vertical,
  licensable: z.boolean(),
  description: ShowcaseDescription,
  completedOn: IsoDate,
  skillIds: z.array(SkillId).min(1).max(5),
  liveUrl: ShowcaseUrl.nullable().default(null),
  demoUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoUrl: ShowcaseUrl.nullable().default(null),
  pitchDeckUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoId: PitchVideoId.nullable().default(null),
  builder: ShowcaseBuilder,
  demoData: z.boolean().default(true),
});
export type ShowcaseDetail = z.infer<typeof ShowcaseDetail>;

/** `PUT /api/me/projects/{id}/showcase` body (story 1-12); owner only, 404 for others. */
export const ShowcaseEdit = z.strictObject({
  description: ShowcaseDescription.default(""),
  liveUrl: ShowcaseUrl.nullable().default(null),
  demoUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoUrl: ShowcaseUrl.nullable().default(null),
  pitchDeckUrl: ShowcaseUrl.nullable().default(null),
  showcased: z.boolean(),
});
export type ShowcaseEdit = z.infer<typeof ShowcaseEdit>;
export type ShowcaseEditInput = z.input<typeof ShowcaseEdit>;

/**
 * The builder's own view of one project's showcase entry, returned by the edit endpoint and
 * listed on `/profile` (story 5-9): the status pill the builder sees, not the public card.
 * Extends `Project` (same `id/title/vertical/licensable/completedOn/skillIds/status/demoData`,
 * same `skillIds` bounds) instead of duplicating it.
 */
export const ShowcaseProject = Project.extend({
  description: ShowcaseDescription,
  liveUrl: ShowcaseUrl.nullable().default(null),
  demoUrl: ShowcaseUrl.nullable().default(null),
  pitchVideoUrl: ShowcaseUrl.nullable().default(null),
  pitchDeckUrl: ShowcaseUrl.nullable().default(null),
  showcased: z.boolean(),
  showcaseStatus: ShowcaseStatus,
});
export type ShowcaseProject = z.infer<typeof ShowcaseProject>;

/**
 * One résumé-derived chip (D-50); `skillId` is set only when the label matches a vocabulary
 * skill, so the builder still sees the vocabulary's display name.
 */
export const SkillSuggestion = z.strictObject({
  label: SkillSetEntry,
  skillId: SkillId.nullable().default(null),
});
export type SkillSuggestion = z.infer<typeof SkillSuggestion>;

/**
 * `POST /api/me/skills/suggest` response. A null adapter, missing key or timeout answers
 * `{available: false, suggestions: []}`, never a 5xx (D-50).
 */
export const SkillSuggestions = z.strictObject({
  available: z.boolean(),
  suggestions: z.array(SkillSuggestion).max(20),
});
export type SkillSuggestions = z.infer<typeof SkillSuggestions>;

/**
 * `POST /api/me/skills/suggest` body. The text is sent to Claude Haiku 4.5 and is never stored
 * or logged (D-50).
 */
export const SkillSuggestRequest = z.strictObject({
  resumeText: z.string().min(50).max(20000),
});
export type SkillSuggestRequest = z.infer<typeof SkillSuggestRequest>;

// `PendingShowcase`/`DecidedShowcase` live with the other admin-queue row shapes above (next to
// `PendingProject`/`DecidedProject`), wired into `PendingQueue`/`DecidedQueue`'s `showcase` list.
