/**
 * Seam: the Zod brief accepts an hourly budget of USD 1 to 250 and rejects anything outside
 * (D-59; spec 2026-10-02-hourly-pricing-design.md §Rules). The Pydantic mirror carries the same
 * bounds, proven by the parity test.
 */
import { describe, expect, it } from "vitest";

import { PartialBrief, VentureBrief } from "../src/index.js";

const healthPilot = {
  id: "brief-health-01",
  title: "Health pilot",
  vertical: "health",
  requiredSkills: ["python", "ai-metta", "ui-ux"],
  maximumTeamSize: 3,
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-09-29",
  deliveryMode: "hybrid",
  hourlyBudget: 50,
  preferReusableIp: true,
};

describe("hourlyBudget bounds", () => {
  it.each([1, 250])("accepts %i", (budget) => {
    expect(VentureBrief.parse({ ...healthPilot, hourlyBudget: budget }).hourlyBudget).toBe(budget);
    expect(PartialBrief.parse({ hourlyBudget: budget }).hourlyBudget).toBe(budget);
  });

  it.each([0, 251, 12.5])("rejects %d naming the field", (budget) => {
    const result = VentureBrief.safeParse({ ...healthPilot, hourlyBudget: budget });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["hourlyBudget"]);
  });

  it("no longer accepts the old dailyBudget field", () => {
    const { hourlyBudget: _, ...rest } = healthPilot;
    expect(VentureBrief.safeParse({ ...rest, dailyBudget: 50 }).success).toBe(false);
  });
});
