/**
 * VentureBrief (PRD §5.3, planning/DOMAIN.md "Venture brief").
 *
 * Mirrors `services/engine/app/models/brief.py`; the parity test keeps the two equal.
 * Money is integer USD per day (D-16). Dates are ISO date-only strings (Africa/Nairobi).
 */
import { z } from "zod";

/** Stable kebab-case IDs (AGENTS.md §Conventions). */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Vertical = z.enum(["health", "agri", "education"]);
export type Vertical = z.infer<typeof Vertical>;

export const DeliveryMode = z.enum(["remote", "hybrid", "on-site"]);
export type DeliveryMode = z.infer<typeof DeliveryMode>;

/** The nine seed skill IDs, in seed order. Never rename one (CONTEXT.md). */
export const SkillId = z.enum([
  "python",
  "ai-metta",
  "ui-ux",
  "frontend",
  "backend",
  "domain-research",
  "mobile",
  "rust",
  "data",
]);
export type SkillId = z.infer<typeof SkillId>;

export const Slug = z.string().regex(SLUG);
export const BriefTitle = z.string().min(1).max(200);
export const RequiredSkills = z.array(SkillId).min(1);
/** Small positive integer (PRD §5.3): 1 to 5. */
export const TeamSize = z.int().min(1).max(5);
export const IsoDate = z.iso.date();
export const Location = z.string().min(1).max(100);
export const DailyBudget = z.int().positive();

export const VentureBrief = z.strictObject({
  id: Slug,
  title: BriefTitle,
  vertical: Vertical,
  requiredSkills: RequiredSkills,
  maximumTeamSize: TeamSize,
  availabilityStart: IsoDate,
  availabilityEnd: IsoDate,
  deliveryMode: DeliveryMode,
  /** Required when deliveryMode is on-site; the engine enforces the pairing. */
  location: Location.nullable().default(null),
  dailyBudget: DailyBudget,
  preferReusableIp: z.boolean(),
  /** Every record in this release is demo data (AGENTS.md non-negotiable 5). */
  demoData: z.boolean().default(true),
});
export type VentureBrief = z.infer<typeof VentureBrief>;
export type VentureBriefInput = z.input<typeof VentureBrief>;

/** keyof VentureBrief on the wire, in PRD §5.3 order. */
export const BriefField = z.enum([
  "id",
  "title",
  "vertical",
  "requiredSkills",
  "maximumTeamSize",
  "availabilityStart",
  "availabilityEnd",
  "deliveryMode",
  "location",
  "dailyBudget",
  "preferReusableIp",
]);
export type BriefField = z.infer<typeof BriefField>;

/** Partial<VentureBrief>: every field optional; `null` and absent both mean unknown. */
export const PartialBrief = z.strictObject({
  id: Slug.nullable().default(null),
  title: BriefTitle.nullable().default(null),
  vertical: Vertical.nullable().default(null),
  requiredSkills: RequiredSkills.nullable().default(null),
  maximumTeamSize: TeamSize.nullable().default(null),
  availabilityStart: IsoDate.nullable().default(null),
  availabilityEnd: IsoDate.nullable().default(null),
  deliveryMode: DeliveryMode.nullable().default(null),
  location: Location.nullable().default(null),
  dailyBudget: DailyBudget.nullable().default(null),
  preferReusableIp: z.boolean().nullable().default(null),
});
export type PartialBrief = z.infer<typeof PartialBrief>;
export type PartialBriefInput = z.input<typeof PartialBrief>;
