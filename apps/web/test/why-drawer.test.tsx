/**
 * Seam: rendered Why this route? drawer (screen 6) through React Testing Library (Sprint 002 #28).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

const PARTNER_FACTS = [
  "(supports-vertical amani-health health)",
  "(partners-with amani-health omni-university)",
  "(cohort-of cohort-2026a omni-university)",
  "(belongs-to amina-otieno cohort-2026a)",
];

async function openHealthPilotDrawer() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
  await user.click(await screen.findByRole("button", { name: "Find my route" }));
  await user.click(await screen.findByRole("button", { name: "Why this route?" }));
  const drawer = await screen.findByRole("dialog", { name: "Why this route?" });
  return { user, drawer };
}

describe("Why this route? drawer", () => {
  it("Founder view lists the partner path with rule partner-fit and its four facts in order", async () => {
    renderApp("/route");
    const { drawer } = await openHealthPilotDrawer();

    const partner = within(drawer).getByTestId("path-partner");
    expect(partner).toHaveTextContent("partner-fit");
    expect(within(partner).getAllByTestId("fact").map((f) => f.textContent)).toEqual(PARTNER_FACTS);
    const amina = within(drawer).getByTestId("path-builder-amina-otieno-python");
    expect(amina).toHaveTextContent("Amina Otieno");
    expect(within(amina).getByTestId("evidence-badge")).toHaveTextContent("Both");
    expect(within(amina).getAllByTestId("fact").length).toBeGreaterThan(3);
  });

  it("Technical view renders every ReasoningPath as rule, monospace facts and conclusion", async () => {
    renderApp("/route");
    const { user, drawer } = await openHealthPilotDrawer();

    await user.click(within(drawer).getByRole("tab", { name: "Technical view" }));

    const paths = await within(drawer).findAllByTestId("technical-path");
    // 3 builder×skill paths + reusable IP + cohort + partner
    expect(paths).toHaveLength(6);
    const partner = paths.find((p) => within(p).getByTestId("technical-rule").textContent === "partner-fit")!;
    const facts = within(partner).getAllByTestId("fact");
    expect(facts.map((f) => f.textContent)).toEqual(PARTNER_FACTS);
    for (const fact of facts) expect(fact.className).toMatch(/font-mono/);
    expect(within(partner).getByTestId("technical-conclusion")).toHaveTextContent("amani-health fits via omni-university");
  });

  it("closes with Escape", async () => {
    renderApp("/route");
    const { user } = await openHealthPilotDrawer();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Why this route?" })).not.toBeInTheDocument();
  });
});
