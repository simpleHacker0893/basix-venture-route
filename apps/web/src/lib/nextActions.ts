/**
 * Next-action buttons (D-29): one per `nextActions` entry, in order. The D-22 assembler actions
 * carry a number the review chip can take; every other action is shown as a suggestion with
 * no side effect in Sprint 002 (blueprint step 6).
 */
import type { Gap, PartialBriefInput } from "@venture-route/contracts";

export type BriefPatch = Partial<Pick<PartialBriefInput, "dailyBudget" | "maximumTeamSize">>;

const BUDGET = /^Raise daily budget to USD (\d+)$/;
const TEAM_SIZE = /^Raise maximum team size to (\d+)$/;

/** The brief change an action text encodes, or null for a suggestion-only action. */
export function patchForAction(gap: Gap, action: string): BriefPatch | null {
  if (gap.category === "budget") {
    const match = BUDGET.exec(action.trim());
    if (match) return { dailyBudget: Number(match[1]) };
  }
  if (gap.category === "team-size") {
    const match = TEAM_SIZE.exec(action.trim());
    if (match) return { maximumTeamSize: Number(match[1]) };
  }
  return null;
}
