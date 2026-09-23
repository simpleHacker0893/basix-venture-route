import type { PartialBriefInput } from "@venture-route/contracts";

import { FIELD_LABELS, MODE_LABELS, SKILL_LABELS, VERTICAL_LABELS } from "./brief";
import { dateRange, usd } from "./format";

type Chip = { field: string; label: string; value: string | null };

/** One chip per brief field: filled chips show the value, missing chips read "missing". */
export function briefChips(brief: PartialBriefInput | null): Chip[] {
  const b = brief ?? {};
  const chips: Chip[] = [
    { field: "title", label: FIELD_LABELS.title, value: b.title ?? null },
    { field: "vertical", label: FIELD_LABELS.vertical, value: b.vertical ? VERTICAL_LABELS[b.vertical] : null },
    {
      field: "requiredSkills",
      label: FIELD_LABELS.requiredSkills,
      value: b.requiredSkills?.length ? b.requiredSkills.map((s) => SKILL_LABELS[s]).join(", ") : null,
    },
    { field: "maximumTeamSize", label: FIELD_LABELS.maximumTeamSize, value: b.maximumTeamSize != null ? String(b.maximumTeamSize) : null },
    {
      field: "availabilityStart",
      label: "Dates",
      value: b.availabilityStart && b.availabilityEnd ? dateRange(b.availabilityStart, b.availabilityEnd) : null,
    },
    { field: "deliveryMode", label: FIELD_LABELS.deliveryMode, value: b.deliveryMode ? MODE_LABELS[b.deliveryMode] : null },
    { field: "dailyBudget", label: FIELD_LABELS.dailyBudget, value: b.dailyBudget != null ? usd(b.dailyBudget) : null },
    {
      field: "preferReusableIp",
      label: FIELD_LABELS.preferReusableIp,
      value: b.preferReusableIp == null ? null : b.preferReusableIp ? "Preferred" : "Not needed",
    },
  ];
  if (b.deliveryMode === "on-site") {
    chips.splice(6, 0, { field: "location", label: FIELD_LABELS.location, value: b.location ?? null });
  }
  return chips;
}
