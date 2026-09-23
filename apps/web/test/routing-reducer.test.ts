/**
 * Seam: the pure routing reducer (Sprint 004, #68). Two flows put an already-confirmed brief
 * and its route into the in-memory routing state: the dashboard's "View route" and the sign-in
 * restore of a stashed publish. One `hydrated` action yields exactly the state a completed
 * route call yields, and selects the route-result view.
 */
import type { VentureBrief, VentureRoute } from "@venture-route/contracts";
import { describe, expect, it } from "vitest";

import { initialRoutingState, routingReducer, type RoutingState } from "../src/state/routingReducer";

const brief: VentureBrief = {
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

const route: VentureRoute = {
  status: "partial",
  builders: [
    {
      builderId: "zawadi-njoroge",
      name: "Zawadi Njoroge",
      dayRate: 130,
      covers: ["rust"],
      evidenceType: "credential",
      evidencePaths: [
        {
          rule: "eligible-builder",
          facts: ["(confirmed admin-basix zawadi-njoroge)"],
          conclusion: "zawadi-njoroge is eligible for rust with credential evidence",
        },
      ],
    },
  ],
  totalDailyRate: 130,
  reusableIp: null,
  cohort: null,
  partner: null,
  gaps: [
    {
      category: "skill",
      statement: "No verified builder for mobile.",
      affected: ["mobile"],
      nextActions: ["Add a builder verified for mobile"],
      rule: "route-gap",
    },
  ],
  rulesApplied: ["eligible-builder", "route-gap"],
  summary: "",
};

function routed(from: RoutingState = initialRoutingState): RoutingState {
  const started = routingReducer(from, { type: "request-started" });
  return routingReducer(started, { type: "response-received", response: { type: "route", brief, route, message: "" } });
}

describe("hydrated", () => {
  it("yields the same state as a completed route call and selects the result view", () => {
    const state = routingReducer(initialRoutingState, { type: "hydrated", brief, route });

    expect(state).toEqual(routed());
    expect(state.view).toBe("result");
    expect(state.currentBrief).toEqual(brief);
    expect(state.lastResponse).toEqual({ type: "route", brief, route, message: "" });
    expect(state.busy).toBe(false);
    expect(state.unreachable).toBeNull();
  });

  it("replaces an in-progress brief, a stale error and a pending request", () => {
    let state = routingReducer(initialRoutingState, {
      type: "brief-changed",
      brief: { title: "Half-typed", vertical: "health" },
    });
    state = routingReducer(state, {
      type: "response-received",
      response: { type: "validation-error", message: "dailyBudget: required" },
    });
    state = routingReducer(state, { type: "engine-unreachable", message: "down" });
    state = routingReducer(state, { type: "request-started" });

    const hydrated = routingReducer(state, { type: "hydrated", brief, route });

    expect(hydrated).toEqual(routed(state));
    expect(hydrated.currentBrief).toEqual(brief);
    expect(hydrated.lastResponse?.type).toBe("route");
    expect(hydrated.busy).toBe(false);
    expect(hydrated.unreachable).toBeNull();
    expect(hydrated.view).toBe("result");
  });

  it("keeps the loaded scenarios and the chat turns", () => {
    let state = routingReducer(initialRoutingState, { type: "scenarios-loaded", scenarios: [brief] });
    state = routingReducer(state, { type: "founder-said", text: "I need a mobile app" });

    const hydrated = routingReducer(state, { type: "hydrated", brief, route });

    expect(hydrated.scenarios).toEqual([brief]);
    expect(hydrated.turns).toEqual([{ role: "founder", text: "I need a mobile app" }]);
  });
});
