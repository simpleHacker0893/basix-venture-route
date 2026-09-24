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

export const DisplayName = z.string().min(1).max(80);
export const Headline = z.string().max(200);
export const ContactField = z.string().max(100);
export const CohortId = z.string().min(1).max(40);
/** Integer USD per day (D-16), same bounds as the brief's daily budget. */
export const DayRate = DailyBudget;

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
  /** Every record in this release is demo data (AGENTS.md non-negotiable 5). */
  demoData: z.boolean().default(true),
});
export type BuilderProfile = z.infer<typeof BuilderProfile>;

/** Proof a builder submits; pending until a BASIX admin confirms it (DOMAIN.md §Marketplace). */
export const Title = z.string().min(1).max(120);
export const Issuer = z.string().min(1).max(120);

export const CredentialInput = z.strictObject({
  title: Title,
  issuer: Issuer,
  skillId: SkillId,
});
export type CredentialInput = z.infer<typeof CredentialInput>;

export const Credential = z.strictObject({
  id: z.string(),
  title: Title,
  issuer: Issuer,
  skillId: SkillId,
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

export const PendingCredential = z.strictObject({
  id: z.string(),
  builderId: z.string(),
  displayName: z.string(),
  title: Title,
  issuer: Issuer,
  skillId: SkillId,
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

export const PendingQueue = z.strictObject({
  accounts: z.array(PendingAccount),
  credentials: z.array(PendingCredential),
  projects: z.array(PendingProject),
});
export type PendingQueue = z.infer<typeof PendingQueue>;

export const DecisionKind = z.enum(["account", "credential", "project"]);
export type DecisionKind = z.infer<typeof DecisionKind>;

export const AdminDecision = z.strictObject({
  id: z.string(),
  kind: DecisionKind,
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
