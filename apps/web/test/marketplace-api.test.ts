/**
 * Seam: the MarketplaceApi client over a mocked fetch (Sprint 004, #67; D-19). Every Sprint 004
 * call sends the bearer on its path, parses the response with the contracts schema, rejects a
 * body outside the contract, and surfaces 403 as a typed error carrying the engine's `detail`
 * verbatim, so the board and the BidDialog can show the engine's sentence unchanged.
 */
import type { RouteSnapshot, VentureBriefInput } from "@venture-route/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApiForbiddenError, ApiNotFoundError, ApiValidationError, needsBearer } from "../src/api/client";
import { createMarketplaceApi } from "../src/api/marketplace";
import { splitFieldMessages } from "../src/lib/validationError";

const path = {
  rule: "eligible-builder",
  facts: ["(confirmed admin-basix naomi-chebet)"],
  conclusion: "naomi-chebet is eligible for mobile with both evidence",
};
const brief: VentureBriefInput = {
  id: "brief-constrained-01",
  title: "Constrained brief",
  vertical: "agri",
  requiredSkills: ["mobile", "rust"],
  maximumTeamSize: 2,
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  deliveryMode: "remote",
  location: null,
  dailyBudget: 300,
  preferReusableIp: false,
  demoData: true,
};
const route: RouteSnapshot = { status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] };
const request = {
  id: "r-1",
  founderId: "user_founder",
  brief,
  route,
  title: "Constrained brief",
  vertical: "agri",
  deliveryMode: "remote",
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  dailyBudget: 300,
  routeStatus: "partial",
  status: "open",
  closedAt: null,
  createdAt: "2026-09-23T07:30:00Z",
  eligibility: { eligible: true, skills: ["mobile"], path, reason: null },
  demoData: true,
};
const bid = {
  id: "b-1",
  requestId: "r-1",
  requestTitle: "Constrained brief",
  requestStatus: "open",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  dayRate: 120,
  message: "",
  eligibleSkills: ["mobile"],
  path,
  status: "submitted",
  createdAt: "2026-09-23T07:30:00Z",
  demoData: true,
};
const entry = {
  action: "propose",
  actor: "founder",
  state: "proposed",
  proposedStart: "2026-09-24T07:30:00Z",
  proposedStartLocal: "2026-09-24T10:30:00+03:00",
  durationMin: 30,
  note: "",
  at: "2026-09-23T07:30:00Z",
};
const booking = {
  id: "k-1",
  requestId: null,
  requestTitle: null,
  founderId: "user_founder",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  state: "proposed",
  proposedStart: "2026-09-24T07:30:00Z",
  proposedStartLocal: "2026-09-24T10:30:00+03:00",
  durationMin: 30,
  note: "",
  history: [entry],
  createdAt: "2026-09-23T07:30:00Z",
  demoData: true,
};
const dashboard = {
  counts: { briefs: 1, routes: { feasible: 0, partial: 1, infeasible: 0 }, openRequests: 1, bidsReceived: 1, bookings: 1 },
  requests: [{ ...request, eligibility: null }],
  bidsReceived: [bid],
  upcomingBookings: [booking],
};

type Call = { url: string; method: string; authorization: string | null; body: unknown };

function mockFetch(status: number, payload: unknown) {
  const calls: Call[] = [];
  const fetchLike = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  });
  return { fetchLike: fetchLike as unknown as typeof fetch, calls };
}

function api(status: number, payload: unknown) {
  const { fetchLike, calls } = mockFetch(status, payload);
  return { api: createMarketplaceApi("http://engine.test", fetchLike, async () => "tok_123"), calls };
}

describe("bearer prefixes", () => {
  it("cover the Sprint 004 paths and still exclude routing", () => {
    for (const p of ["/api/requests", "/api/requests/r-1/bids", "/api/bookings", "/api/bookings/k-1/accept", "/api/me/dashboard", "/api/me/bids", "/api/me/bookings"]) {
      expect(needsBearer(p), p).toBe(true);
    }
    for (const p of ["/api/route", "/api/conversation", "/api/scenarios", "/health"]) expect(needsBearer(p), p).toBe(false);
  });
});

describe("every Sprint 004 call sends the bearer and parses the contract", () => {
  it.each([
    ["listRequests", (a: ReturnType<typeof api>["api"]) => a.listRequests(), 200, [request], "GET", "/api/requests"],
    ["getRequest", (a: ReturnType<typeof api>["api"]) => a.getRequest("r-1"), 200, request, "GET", "/api/requests/r-1"],
    ["postRequest", (a: ReturnType<typeof api>["api"]) => a.postRequest({ brief, route }), 201, request, "POST", "/api/requests"],
    ["closeRequest", (a: ReturnType<typeof api>["api"]) => a.closeRequest("r-1"), 200, { ...request, status: "closed" }, "POST", "/api/requests/r-1/close"],
    ["getEligibility", (a: ReturnType<typeof api>["api"]) => a.getEligibility("r-1"), 200, request.eligibility, "GET", "/api/requests/r-1/eligibility"],
    ["postBid", (a: ReturnType<typeof api>["api"]) => a.postBid("r-1", { dayRate: 120, message: "" }), 201, bid, "POST", "/api/requests/r-1/bids"],
    ["listBidsOnRequest", (a: ReturnType<typeof api>["api"]) => a.listBidsOnRequest("r-1"), 200, [bid], "GET", "/api/requests/r-1/bids"],
    ["listMyBids", (a: ReturnType<typeof api>["api"]) => a.listMyBids(), 200, [bid], "GET", "/api/me/bids"],
    ["postBooking", (a: ReturnType<typeof api>["api"]) => a.postBooking({ builderId: "naomi-chebet", requestId: null, proposedStart: entry.proposedStart, durationMin: 30, note: "" }), 201, booking, "POST", "/api/bookings"],
    ["acceptBooking", (a: ReturnType<typeof api>["api"]) => a.acceptBooking("k-1"), 200, { ...booking, state: "accepted" }, "POST", "/api/bookings/k-1/accept"],
    ["counterBooking", (a: ReturnType<typeof api>["api"]) => a.counterBooking("k-1", { proposedStart: entry.proposedStart, durationMin: 45, note: "" }), 200, { ...booking, state: "countered" }, "POST", "/api/bookings/k-1/counter"],
    ["confirmBooking", (a: ReturnType<typeof api>["api"]) => a.confirmBooking("k-1"), 200, { ...booking, state: "confirmed" }, "POST", "/api/bookings/k-1/confirm"],
    ["listMyBookings", (a: ReturnType<typeof api>["api"]) => a.listMyBookings(), 200, [booking], "GET", "/api/me/bookings"],
    ["getDashboard", (a: ReturnType<typeof api>["api"]) => a.getDashboard(), 200, dashboard, "GET", "/api/me/dashboard"],
  ] as const)("%s", async (_name, call, status, payload, method, expectedPath) => {
    const { api: client, calls } = api(status, payload);

    const result = await call(client);

    expect(result).toEqual(payload);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`http://engine.test${expectedPath}`);
    expect(calls[0]?.method).toBe(method);
    expect(calls[0]?.authorization).toBe("Bearer tok_123");
  });

  it("posts exactly the bodies the engine expects", async () => {
    const { api: client, calls } = api(201, request);
    await client.postRequest({ brief, route });
    expect(calls[0]?.body).toEqual({ brief, route });

    const { api: bids, calls: bidCalls } = api(201, bid);
    await bids.postBid("r-1", { dayRate: 120, message: "Hi" });
    expect(bidCalls[0]?.body).toEqual({ dayRate: 120, message: "Hi" });
  });

  it("rejects a body outside the contract", async () => {
    const { api: client } = api(200, [{ ...request, status: "paused" }]);

    await expect(client.listRequests()).rejects.toThrow(/outside the contract/);
  });
});

describe("errors keep their types", () => {
  it("surfaces a 403 as ApiForbiddenError whose reason is the detail verbatim", async () => {
    const reason = "eligible-builder does not hold for ali-hassan on any of mobile, rust.";
    const { api: client } = api(403, { detail: reason });

    const error = await client.postBid("r-1", { dayRate: 120, message: "" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiForbiddenError);
    expect((error as ApiForbiddenError).reason).toBe(reason);
    expect((error as ApiForbiddenError).message).toBe(reason);
  });

  it("keeps the typed 404", async () => {
    const { api: client } = api(404, { detail: "no request r-9" });

    await expect(client.getRequest("r-9")).rejects.toBeInstanceOf(ApiNotFoundError);
  });

  it("maps a 422 to field messages", async () => {
    const { api: client } = api(422, {
      type: "validation-error",
      message: "dayRate: Input should be greater than 0; message: String should have at most 1000 characters",
    });

    const error = await client.postBid("r-1", { dayRate: 0, message: "" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiValidationError);
    expect(splitFieldMessages((error as ApiValidationError).message, ["dayRate", "message"])).toEqual([
      { field: "dayRate", text: "Input should be greater than 0" },
      { field: "message", text: "String should have at most 1000 characters" },
    ]);
  });

  it("surfaces a 409 as an unreachable error naming the status and the detail", async () => {
    const { api: client } = api(409, { detail: "already bid" });

    const error = await client.postBid("r-1", { dayRate: 120, message: "" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("409");
    expect((error as Error).message).toContain("already bid");
  });
});
