/**
 * Seam: the pure function handoffText(brief, route) in Vitest (Sprint 002 #29, D-19).
 * Inputs are the generated snapshot (what the engine decided); the summary is a sentinel that
 * must never appear in the handoff (AGENTS.md rule 3).
 */
import { VentureBrief, VentureRoute } from "@venture-route/contracts";
import { describe, expect, it } from "vitest";

import { handoffText } from "../src/features/handoff/handoffText";
import snapshot from "../src/offline/snapshot.json";

const SENTINEL = "LLM-SUMMARY-SENTINEL-DO-NOT-SHIP";

function scenario(id: keyof typeof snapshot.routes) {
  const brief = VentureBrief.parse(snapshot.briefs[id]);
  const route = VentureRoute.parse({ ...snapshot.routes[id], summary: SENTINEL });
  return { brief, route };
}

describe("handoffText", () => {
  it("Health pilot: status, three team lines with day rates, total, IP, cohort, partner, rules, disclaimer", () => {
    const { brief, route } = scenario("brief-health-01");

    const text = handoffText(brief, route);

    expect(text).toContain("VENTURE ROUTE HANDOFF");
    expect(text).toContain("Brief: Health pilot: triage assistant for community clinics");
    expect(text).toContain("STATUS: Feasible");
    expect(text).toContain("- Amina Otieno · Python · Both · USD 120 / day");
    expect(text).toContain("- Daniel Kiptoo · AI / MeTTa · Both · USD 150 / day");
    expect(text).toContain("- Grace Wambui · UI/UX design · Credential · USD 100 / day");
    expect(text).toContain("TOTAL DAY RATE: USD 370 / day");
    expect(text).toContain("REUSABLE IP: Afya Triage (asset-afya-triage)");
    expect(text).toContain("COHORT: cohort-2026a, omni-university");
    expect(text).toContain("PARTNER: amani-health");
    expect(text).toContain("RULES APPLIED: cohort-of, eligible-builder, partner-fit, reuse-fit");
    expect(text).toContain("All records are demo data.");
    expect(text).not.toContain(SENTINEL);
  });

  it("Constrained brief: gaps with only the engine's next actions, no IP or partner lines", () => {
    const { brief, route } = scenario("brief-constrained-01");

    const text = handoffText(brief, route);

    expect(text).toContain("STATUS: Partial");
    expect(text).toContain("GAPS");
    expect(text).toContain("- skill (route-gap): mobile");
    expect(text).toContain("  * Ask BASIX to confirm a credential or project for mobile.");
    expect(text).toContain("REUSABLE IP: none");
    expect(text).toContain("PARTNER: none");
    expect(text).not.toContain(SENTINEL);
  });

  it("is deterministic for the same inputs", () => {
    const { brief, route } = scenario("brief-agri-01");

    expect(handoffText(brief, route)).toBe(handoffText(brief, route));
  });
});
