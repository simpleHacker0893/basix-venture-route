import type { ReasoningPath, VentureRoute } from "@venture-route/contracts";

import { SKILL_LABELS } from "./brief";

export type NamedPath = { key: string; title: string; path: ReasoningPath };

export function skillLabel(skill: string): string {
  return SKILL_LABELS[skill as keyof typeof SKILL_LABELS] ?? skill;
}

/** Every ReasoningPath the route carries, in screen order: builder×skill, IP, cohort, partner (D-31). */
export function namedPaths(route: VentureRoute): NamedPath[] {
  const paths: NamedPath[] = [];
  for (const builder of route.builders) {
    builder.evidencePaths.forEach((path, index) => {
      const skill = builder.covers[index] ?? builder.covers[0] ?? "";
      paths.push({
        key: `builder-${builder.builderId}-${skill}`,
        title: `${builder.name} covers ${skillLabel(skill)}`,
        path,
      });
    });
  }
  if (route.reusableIp) {
    paths.push({ key: "ip", title: `${route.reusableIp.title} is reusable IP`, path: route.reusableIp.path });
  }
  if (route.cohort) {
    paths.push({
      key: "cohort",
      title: `${route.cohort.cohortId} of ${route.cohort.universityId}`,
      path: route.cohort.path,
    });
  }
  if (route.partner) {
    paths.push({ key: "partner", title: `${route.partner.partnerId} is a partner fit`, path: route.partner.path });
  }
  return paths;
}
