/**
 * The ecosystem entities the seed graph reasons over (`services/engine/seed/facts.metta`:
 * `cohort-of`, `supports-vertical`, `partners-with`). `test/ecosystem.test.ts` proves these
 * equal the seed file, so the /ecosystem page never shows an entity the engine does not hold
 * (AGENTS.md rule 10). Every one of them is fictional demo data.
 */
import type { Vertical } from "@venture-route/contracts";

export type University = Readonly<{ id: string; cohorts: readonly string[] }>;
export type Partner = Readonly<{ id: string; vertical: Vertical; university: string }>;

export const UNIVERSITIES: readonly University[] = [
  { id: "omni-university", cohorts: ["cohort-2026a"] },
  { id: "lakeside-university", cohorts: ["cohort-2026b"] },
  { id: "savanna-institute", cohorts: ["cohort-2025c"] },
];

export const PARTNERS: readonly Partner[] = [
  { id: "amani-health", vertical: "health", university: "omni-university" },
  { id: "shamba-agri", vertical: "agri", university: "lakeside-university" },
  { id: "elimu-education", vertical: "education", university: "savanna-institute" },
  { id: "afya-plus", vertical: "health", university: "lakeside-university" },
];

/** The seven MeTTa rules (CONTEXT.md), in DOMAIN.md order. */
export const METTA_RULES = [
  "verified-for-skill",
  "mode-compatible",
  "available-for-brief",
  "eligible-builder",
  "reuse-fit",
  "partner-fit",
  "route-gap",
] as const;

/** `amani-health` → `Amani Health`: the same id-to-name derivation as builder names (D-24). */
export function entityName(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
