/**
 * Marketplace contracts (Sprint 003, spec #35 §Marketplace API).
 *
 * Mirrors `services/engine/app/marketplace/schemas.py`; the parity test keeps the two equal.
 * One skill shape everywhere: `{ id, name, status, evidence }`, where a self-described skill is
 * display only and never verified (CONTEXT.md "Self-described skill").
 */
import { z } from "zod";

import { DailyBudget, IsoDate, Location, SkillId, Vertical } from "./brief.js";

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
