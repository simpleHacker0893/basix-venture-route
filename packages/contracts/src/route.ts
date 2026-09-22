/**
 * VentureRoute (PRD §5.4, planning/DOMAIN.md "Route", "Reasoning path", "Gap").
 *
 * Mirrors `services/engine/app/models/route.py` and `engine.py`. `status` is a plain enum set by
 * the route service (D-09); the browser renders this object and never parses MeTTa output.
 */
import { z } from "zod";

import { SkillId } from "./brief.js";

export const RouteStatus = z.enum(["feasible", "partial", "infeasible"]);
export type RouteStatus = z.infer<typeof RouteStatus>;

export const EvidenceType = z.enum(["credential", "project", "both"]);
export type EvidenceType = z.infer<typeof EvidenceType>;

export const GapCategory = z.enum(["skill", "availability", "mode", "location", "team-size", "budget"]);
export type GapCategory = z.infer<typeof GapCategory>;

/** The seven MeTTa rules plus the two assembler rules (CONTEXT.md). */
export const RuleName = z.enum([
  "verified-for-skill",
  "mode-compatible",
  "available-for-brief",
  "eligible-builder",
  "reuse-fit",
  "partner-fit",
  "route-gap",
  "assembler.team-size-fit",
  "assembler.budget-fit",
]);
export type RuleName = z.infer<typeof RuleName>;

/** Graph predicates read directly for a reasoning path that no named rule produces. */
export const LookupName = z.enum(["cohort-of"]);
export type LookupName = z.infer<typeof LookupName>;

/** Integers on the wire; the Pydantic mirror carries the same JavaScript safe-integer bounds. */
export const UsdPerDay = z.int();

export const ReasoningPath = z.object({
  rule: z.union([RuleName, LookupName]),
  /** Source facts as written in the space, in match order. */
  facts: z.array(z.string()),
  conclusion: z.string(),
});
export type ReasoningPath = z.infer<typeof ReasoningPath>;

export const Gap = z.object({
  category: GapCategory,
  statement: z.string(),
  affected: z.array(z.string()),
  nextActions: z.array(z.string()),
  rule: RuleName,
});
export type Gap = z.infer<typeof Gap>;

export const RouteBuilder = z.object({
  builderId: z.string(),
  name: z.string(),
  dayRate: UsdPerDay,
  covers: z.array(SkillId),
  evidenceType: EvidenceType,
  evidencePaths: z.array(ReasoningPath),
});
export type RouteBuilder = z.infer<typeof RouteBuilder>;

export const ReusableIp = z.object({
  assetId: z.string(),
  title: z.string(),
  path: ReasoningPath,
});
export type ReusableIp = z.infer<typeof ReusableIp>;

export const RouteCohort = z.object({
  cohortId: z.string(),
  universityId: z.string(),
  path: ReasoningPath,
});
export type RouteCohort = z.infer<typeof RouteCohort>;

export const RoutePartner = z.object({
  partnerId: z.string(),
  path: ReasoningPath,
});
export type RoutePartner = z.infer<typeof RoutePartner>;

export const VentureRoute = z.object({
  status: RouteStatus,
  builders: z.array(RouteBuilder),
  totalDailyRate: UsdPerDay,
  reusableIp: ReusableIp.nullable().default(null),
  cohort: RouteCohort.nullable().default(null),
  partner: RoutePartner.nullable().default(null),
  gaps: z.array(Gap),
  rulesApplied: z.array(z.string()),
  summary: z.string(),
});
export type VentureRoute = z.infer<typeof VentureRoute>;
