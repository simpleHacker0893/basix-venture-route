/**
 * Seam: Zod parses what the engine emits (Sprint 004, #54, D-19).
 *
 * Each sample below is the verbatim `model_dump_json(by_alias=True)` of the Pydantic mirror
 * (`services/engine/app/marketplace/schemas.py`), produced once and pasted as a known-good
 * literal. The parity test proves the schemas are equal; this test proves the Out shapes the
 * web will receive round-trip through Zod without loss, and that the literal unions reject
 * values outside the contract.
 */
import { describe, expect, it } from "vitest";

import { Bid, Booking, BookingProposal, Dashboard, Eligibility, Request } from "../src/index.js";

const path = {
  rule: "eligible-builder",
  facts: [
    "(earned naomi-chebet cred-1a2b3c4d)",
    "(proves cred-1a2b3c4d mobile)",
    "(confirmed admin-basix cred-1a2b3c4d)",
    "(supports-mode naomi-chebet remote)",
    "(available naomi-chebet 2026-09-22 2026-10-20)",
    "(confirmed admin-basix naomi-chebet)",
  ],
  conclusion: "naomi-chebet is eligible for mobile with credential evidence",
};

const eligibility = { eligible: true, skills: ["mobile"], path, reason: null };

const request = {
  id: "0f9c1b2e-5d6a-4b7c-8e9f-0a1b2c3d4e5f",
  founderId: "user_founder",
  brief: {
    id: "brief-constrained-01",
    title: "Constrained brief",
    vertical: "health",
    requiredSkills: ["mobile", "rust"],
    maximumTeamSize: 2,
    availabilityStart: "2026-09-22",
    availabilityEnd: "2026-10-06",
    deliveryMode: "remote",
    location: null,
    dailyBudget: 300,
    preferReusableIp: false,
    demoData: true,
  },
  route: { status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] },
  title: "Constrained brief",
  vertical: "health",
  deliveryMode: "remote",
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  dailyBudget: 300,
  routeStatus: "partial",
  status: "open",
  closedAt: null,
  createdAt: "2026-09-23T07:30:00Z",
  eligibility,
  demoData: true,
};

const bid = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  requestId: "0f9c1b2e-5d6a-4b7c-8e9f-0a1b2c3d4e5f",
  requestTitle: "Constrained brief",
  requestStatus: "open",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  dayRate: 120,
  message: "The field survey app demonstrates mobile.",
  eligibleSkills: ["mobile"],
  path,
  status: "submitted",
  createdAt: "2026-09-23T07:30:00Z",
  demoData: true,
};

const historyEntry = {
  action: "propose",
  actor: "founder",
  state: "proposed",
  proposedStart: "2026-09-24T06:00:00Z",
  proposedStartLocal: "2026-09-24T09:00:00+03:00",
  durationMin: 30,
  note: "",
  at: "2026-09-23T07:30:00Z",
};

const booking = {
  id: "2b3c4d5e-0000-4000-8000-000000000002",
  requestId: "0f9c1b2e-5d6a-4b7c-8e9f-0a1b2c3d4e5f",
  requestTitle: "Constrained brief",
  founderId: "user_founder",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  state: "proposed",
  proposedStart: "2026-09-24T06:00:00Z",
  proposedStartLocal: "2026-09-24T09:00:00+03:00",
  durationMin: 30,
  note: "",
  history: [historyEntry],
  createdAt: "2026-09-23T07:30:00Z",
  demoData: true,
};

const dashboard = {
  counts: {
    briefs: 1,
    routes: { feasible: 0, partial: 1, infeasible: 0 },
    openRequests: 1,
    bidsReceived: 1,
    bookings: 1,
  },
  requests: [{ ...request, eligibility: null }],
  bidsReceived: [bid],
  upcomingBookings: [booking],
};

describe("the engine's Out shapes round-trip through Zod", () => {
  it.each([
    ["Request", Request, request],
    ["Bid", Bid, bid],
    ["Booking", Booking, booking],
    ["Eligibility", Eligibility, eligibility],
    ["Dashboard", Dashboard, dashboard],
  ] as const)("%s", (_name, schema, sample) => {
    expect(schema.parse(sample)).toEqual(sample);
  });

  it("rejects an unknown key, as the engine's extra=forbid does", () => {
    expect(Bid.safeParse({ ...bid, rank: 1 }).success).toBe(false);
  });
});

const proposal = { proposedStart: "2026-09-24T06:00:00Z", durationMin: 30, note: "" };

describe("literal unions", () => {
  it("durationMin is 30 or 45 and an integer", () => {
    expect(BookingProposal.safeParse({ ...proposal, durationMin: 45 }).success).toBe(true);
    expect(BookingProposal.safeParse({ ...proposal, durationMin: 60 }).success).toBe(false);
    expect(BookingProposal.safeParse({ ...proposal, durationMin: "30" }).success).toBe(false);
  });

  it("state, action and actor take only the machine's values", () => {
    expect(Booking.safeParse({ ...booking, state: "cancelled" }).success).toBe(false);
    expect(
      Booking.safeParse({ ...booking, history: [{ ...historyEntry, action: "reject" }] }).success,
    ).toBe(false);
    expect(
      Booking.safeParse({ ...booking, history: [{ ...historyEntry, actor: "admin" }] }).success,
    ).toBe(false);
  });

  it("proposedStart needs an offset and counts stay integers", () => {
    expect(BookingProposal.safeParse({ ...proposal, proposedStart: "2026-09-24T06:00:00" }).success).toBe(
      false,
    );
    expect(Dashboard.safeParse({ ...dashboard, counts: { ...dashboard.counts, briefs: 1.5 } }).success).toBe(false);
    expect(Dashboard.safeParse({ ...dashboard, counts: { ...dashboard.counts, briefs: -1 } }).success).toBe(false);
  });
});
