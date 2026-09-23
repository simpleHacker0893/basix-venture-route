/**
 * handoffText(brief, route): the plain-text venture handoff, generated client-side from the
 * structured VentureBrief and VentureRoute only. It never includes route.summary or any other
 * language-model text (AGENTS.md rule 3; requirements.md In scope 6). Pure and deterministic.
 */
import type { VentureBrief, VentureRoute } from "@venture-route/contracts";

import { MODE_LABELS, SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { EVIDENCE_LABEL, STATUS_LABEL, dateRange, usd } from "../../lib/format";

const DEMO_DISCLAIMER =
  "All records are demo data. Routes are computed by MeTTa rules over demo records; this handoff restates the structured route only.";

export function handoffText(brief: VentureBrief, route: VentureRoute): string {
  const lines: string[] = [];
  lines.push("VENTURE ROUTE HANDOFF");
  lines.push("");
  lines.push(`Brief: ${brief.title}`);
  lines.push(`Id: ${brief.id}`);
  lines.push(`Vertical: ${VERTICAL_LABELS[brief.vertical]}`);
  lines.push(`Skills: ${brief.requiredSkills.map((s) => SKILL_LABELS[s]).join(", ")}`);
  lines.push(`Window: ${dateRange(brief.availabilityStart, brief.availabilityEnd)}`);
  lines.push(`Mode: ${MODE_LABELS[brief.deliveryMode]}${brief.location ? ` (${brief.location})` : ""}`);
  lines.push(`Team size: up to ${brief.maximumTeamSize}`);
  lines.push(`Budget: ${usd(brief.dailyBudget)}`);
  lines.push(`Reusable IP: ${brief.preferReusableIp ? "preferred" : "not required"}`);
  lines.push("");
  lines.push(`STATUS: ${STATUS_LABEL[route.status]}`);
  lines.push("");

  if (route.gaps.length > 0) {
    lines.push("GAPS");
    for (const gap of route.gaps) {
      lines.push(`- ${gap.category} (${gap.rule}): ${gap.affected.join(", ")}`);
      lines.push(`  ${gap.statement}`);
      for (const action of gap.nextActions) lines.push(`  * ${action}`);
    }
    lines.push("");
  }

  lines.push("TEAM");
  if (route.builders.length === 0) {
    lines.push("- none: no verified builder fits this brief yet");
  }
  for (const builder of route.builders) {
    const skills = builder.covers.map((s) => SKILL_LABELS[s]).join(", ");
    lines.push(`- ${builder.name} · ${skills} · ${EVIDENCE_LABEL[builder.evidenceType]} · ${usd(builder.dayRate)}`);
  }
  lines.push(`TOTAL DAY RATE: ${usd(route.totalDailyRate)}`);
  lines.push("");

  lines.push(
    route.reusableIp ? `REUSABLE IP: ${route.reusableIp.title} (${route.reusableIp.assetId})` : "REUSABLE IP: none",
  );
  lines.push(route.cohort ? `COHORT: ${route.cohort.cohortId}, ${route.cohort.universityId}` : "COHORT: none");
  lines.push(route.partner ? `PARTNER: ${route.partner.partnerId}` : "PARTNER: none");
  lines.push("");
  lines.push(`RULES APPLIED: ${route.rulesApplied.join(", ")}`);
  lines.push("");
  lines.push(DEMO_DISCLAIMER);
  return lines.join("\n") + "\n";
}

export function handoffFileName(brief: VentureBrief): string {
  return `venture-route-${brief.id}.txt`;
}
