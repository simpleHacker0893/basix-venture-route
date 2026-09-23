/**
 * Brief helpers shared by intake, review and the form: display labels from DOMAIN.md, the
 * founder-facing field order from PRD §5.3, and the client-side "what is still missing" check
 * that mirrors the engine's orchestrator (location joins when the mode is on-site).
 */
import {
  DeliveryMode,
  SkillId,
  Vertical,
  type BriefField,
  type PartialBriefInput,
  type VentureBriefInput,
} from "@venture-route/contracts";

export const SKILL_LABELS: Record<SkillId, string> = {
  python: "Python",
  "ai-metta": "AI / MeTTa",
  "ui-ux": "UI/UX design",
  frontend: "Frontend",
  backend: "Backend",
  "domain-research": "Domain research",
  mobile: "Mobile",
  rust: "Rust",
  data: "Data engineering",
};

export const VERTICAL_LABELS: Record<Vertical, string> = {
  health: "Health",
  agri: "Agri",
  education: "Education",
};

export const MODE_LABELS: Record<DeliveryMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  "on-site": "On-site",
};

export const SKILLS = SkillId.options;
export const VERTICALS = Vertical.options;
export const MODES = DeliveryMode.options;

/** Founder-facing fields the engine asks for, in PRD §5.3 order (id is generated). */
export const REQUIRED_FIELDS: readonly BriefField[] = [
  "title",
  "vertical",
  "requiredSkills",
  "maximumTeamSize",
  "availabilityStart",
  "availabilityEnd",
  "deliveryMode",
  "dailyBudget",
  "preferReusableIp",
];

export const FIELD_LABELS: Record<BriefField, string> = {
  id: "Id",
  title: "Title",
  vertical: "Vertical",
  requiredSkills: "Skills",
  maximumTeamSize: "Team size",
  availabilityStart: "Start",
  availabilityEnd: "End",
  deliveryMode: "Mode",
  location: "Location",
  dailyBudget: "Budget",
  preferReusableIp: "Reusable IP",
};

export function missingFields(brief: PartialBriefInput | null): BriefField[] {
  const values: Partial<Record<BriefField, unknown>> = brief ?? {};
  const missing = REQUIRED_FIELDS.filter((field) => values[field] == null);
  if (values.deliveryMode === "on-site" && !values.location) missing.push("location");
  return missing;
}

/** `Health pilot` → `brief-health-pilot`, the same shape the engine derives. */
export function briefIdFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `brief-${slug || "untitled"}`;
}

/** A partial brief with every required field set becomes a full brief input (id derived). */
export function toBriefInput(brief: PartialBriefInput): VentureBriefInput | null {
  if (missingFields(brief).length > 0) return null;
  return {
    id: brief.id ?? briefIdFor(brief.title ?? ""),
    title: brief.title!,
    vertical: brief.vertical!,
    requiredSkills: brief.requiredSkills!,
    maximumTeamSize: brief.maximumTeamSize!,
    availabilityStart: brief.availabilityStart!,
    availabilityEnd: brief.availabilityEnd!,
    deliveryMode: brief.deliveryMode!,
    location: brief.location ?? null,
    dailyBudget: brief.dailyBudget!,
    preferReusableIp: brief.preferReusableIp!,
    demoData: true,
  };
}

/** Short chip labels for the seed scenarios (DESIGN.md intake prompt); other briefs use their title. */
export const CHIP_LABELS: Record<string, string> = {
  "brief-health-01": "Health pilot",
  "brief-agri-01": "Agri marketplace",
  "brief-constrained-01": "Constrained brief",
  "brief-budget-01": "Budget challenge",
  "brief-onsite-01": "Delivery-mode challenge",
};
