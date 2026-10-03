/**
 * Seam: pure function `briefChips` (D-19). The budget chip reads per hour (D-59; spec
 * 2026-10-02-hourly-pricing-design.md §Screens).
 */
import { describe, expect, it } from "vitest";

import { briefChips } from "../src/lib/briefChips";

describe("briefChips budget", () => {
  it("labels the budget per hour and shows the amount an hour", () => {
    const chip = briefChips({ hourlyBudget: 50 }).find((c) => c.field === "hourlyBudget");

    expect(chip).toEqual({ field: "hourlyBudget", label: "Budget per hour (USD)", value: "USD 50 an hour" });
  });

  it("marks a missing budget as missing", () => {
    const chip = briefChips({}).find((c) => c.field === "hourlyBudget");

    expect(chip?.value).toBeNull();
  });
});
