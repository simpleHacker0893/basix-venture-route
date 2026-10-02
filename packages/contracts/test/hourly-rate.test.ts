/**
 * Seam: a builder's hourly rate is a whole USD 0 to 50, 0 meaning free or volunteer (D-59;
 * spec 2026-10-02-hourly-pricing-design.md §Rules, ticket #159). The Pydantic mirror carries the
 * same bounds, proven by the parity test.
 */
import { describe, expect, it } from "vitest";

import { BuilderProfile, Candidate, ProfileInput } from "../src/index.js";

const profileInput = {
  displayName: "Amina Otieno",
  location: "Nairobi",
  hourlyRate: 19,
  modes: { remote: true, hybrid: false, onSite: false },
  selfDescribedSkills: [],
  sharing: { email: true, phone: false, linkedin: false },
  availability: [],
};

describe("hourlyRate bounds", () => {
  it.each([0, 50])("accepts %i", (rate) => {
    expect(ProfileInput.parse({ ...profileInput, hourlyRate: rate }).hourlyRate).toBe(rate);
  });

  it.each([-1, 51, 12.5])("rejects %d naming the field", (rate) => {
    const result = ProfileInput.safeParse({ ...profileInput, hourlyRate: rate });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["hourlyRate"]);
  });

  it("no longer accepts the old dayRate field", () => {
    const { hourlyRate: _, ...rest } = profileInput;
    expect(ProfileInput.safeParse({ ...rest, dayRate: 150 }).success).toBe(false);
  });

  it("is the rate the builder profile and the candidate carry", () => {
    expect(Object.keys(BuilderProfile.shape)).toContain("hourlyRate");
    expect(Object.keys(Candidate.shape)).toContain("hourlyRate");
    expect(Object.keys(Candidate.shape)).not.toContain("dayRate");
  });
});
