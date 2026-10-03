/**
 * Seam: a request's budget and a bid's rate are per hour (D-59; spec
 * 2026-10-02-hourly-pricing-design.md, ticket #160). The request's `hourlyBudget` has the brief's
 * bounds (1-250) and a bid's `hourlyRate` the profile rate's (0-50). The Pydantic mirror carries
 * the same bounds, proven by the parity test.
 */
import { describe, expect, it } from "vitest";

import { Bid, BidCreate, Request } from "../src/index.js";

const brief = {
  id: "brief-constrained-01",
  title: "Constrained brief",
  vertical: "health",
  requiredSkills: ["mobile", "rust"],
  maximumTeamSize: 2,
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  deliveryMode: "remote",
  location: null,
  hourlyBudget: 38,
  preferReusableIp: false,
  demoData: true,
};

const request = {
  id: "r-1",
  founderId: "user_founder",
  brief,
  route: { status: "partial", totalHourlyRate: 16, builderIds: ["zawadi-njoroge"] },
  title: "Constrained brief",
  vertical: "health",
  deliveryMode: "remote",
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  hourlyBudget: 38,
  routeStatus: "partial",
  status: "open",
  closedAt: null,
  createdAt: "2026-09-23T10:00:00Z",
  eligibility: null,
  demoData: true,
};

const bid = {
  id: "b-1",
  requestId: "r-1",
  requestTitle: "Constrained brief",
  requestStatus: "open",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  hourlyRate: 15,
  message: "",
  eligibleSkills: ["mobile"],
  path: { rule: "eligible-builder", facts: [], conclusion: "(eligible-builder)" },
  status: "submitted",
  createdAt: "2026-09-23T10:00:00Z",
  demoData: true,
};

const issuePaths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join("."));

describe("request hourlyBudget", () => {
  it.each([1, 250])("accepts %i", (budget) => {
    expect(Request.parse({ ...request, hourlyBudget: budget }).hourlyBudget).toBe(budget);
  });

  it.each([0, 251, 12.5])("rejects %d naming the field", (budget) => {
    const result = Request.safeParse({ ...request, hourlyBudget: budget });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["hourlyBudget"]);
  });

  it("no longer carries the old dailyBudget field", () => {
    expect(Object.keys(Request.shape)).not.toContain("dailyBudget");
  });
});

describe("bid hourlyRate", () => {
  it.each([0, 50])("accepts %i on create and on the bid", (rate) => {
    expect(BidCreate.parse({ hourlyRate: rate }).hourlyRate).toBe(rate);
    expect(Bid.parse({ ...bid, hourlyRate: rate }).hourlyRate).toBe(rate);
  });

  it.each([-1, 51, 12.5])("rejects %d naming the field", (rate) => {
    const result = BidCreate.safeParse({ hourlyRate: rate });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["hourlyRate"]);
    expect(Bid.safeParse({ ...bid, hourlyRate: rate }).success).toBe(false);
  });

  it("no longer accepts the old dayRate field", () => {
    expect(BidCreate.safeParse({ dayRate: 15 }).success).toBe(false);
    expect(Object.keys(Bid.shape)).not.toContain("dayRate");
  });
});
