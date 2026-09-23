/**
 * Seam: rendered route result screen (screen 5) through React Testing Library (Sprint 002 #27).
 * Expected values are the exact DOMAIN.md scenarios as the engine decided them (snapshot).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

async function routeScenario(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Load scenario: ${label}` }));
  await user.click(await screen.findByRole("button", { name: "Find my route" }));
  await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" });
  return user;
}

describe("route result: badge, cost strip, gaps first, cards", () => {
  it("Health pilot: Feasible, three builder cards with evidence badges and Demo data pills, IP, cohort, partner", async () => {
    renderApp("/route");
    await routeScenario("Health pilot");

    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Feasible$/);
    const cards = screen.getAllByTestId("builder-card");
    expect(cards.map((c) => within(c).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Amina Otieno",
      "Daniel Kiptoo",
      "Grace Wambui",
    ]);
    expect(cards.map((c) => within(c).getByTestId("evidence-badge").textContent)).toEqual(["Both", "Both", "Credential"]);
    for (const card of cards) expect(within(card).getByText("Demo data")).toBeInTheDocument();
    // Sprint 003 #46: each card links to the founder's candidate view.
    expect(within(cards[0]!).getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/builders/amina-otieno");
    const strip = screen.getByTestId("cost-strip");
    expect(strip).toHaveTextContent("USD 370 / day");
    expect(strip).toHaveTextContent("USD 400 / day");
    expect(screen.getByTestId("ip-card")).toHaveTextContent("asset-afya-triage");
    expect(screen.getByTestId("cohort-card")).toHaveTextContent("cohort-2026a");
    expect(screen.getByTestId("partner-card")).toHaveTextContent("amani-health");
    expect(screen.queryByTestId("gaps-panel")).not.toBeInTheDocument();
  });

  it("Constrained brief: Partial, the Gaps panel precedes the team section in DOM order, two D-29 actions", async () => {
    renderApp("/route");
    await routeScenario("Constrained brief");

    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Partial$/);
    const gaps = screen.getByTestId("gaps-panel");
    const team = screen.getByTestId("team-section");
    expect(gaps.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const gap = within(gaps).getAllByTestId("gap")[0]!;
    expect(gap).toHaveTextContent("route-gap");
    expect(gap).toHaveTextContent("mobile");
    const actions = within(gap).getAllByRole("button");
    expect(actions.map((b) => b.textContent)).toEqual([
      "Ask BASIX to confirm a credential or project for mobile.",
      "Remove mobile from the brief or replace it with a related skill.",
    ]);
    const cards = screen.getAllByTestId("builder-card");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByRole("heading", { level: 3 })).toHaveTextContent("Zawadi Njoroge");
  });

  it("Delivery-mode challenge: Infeasible, three location gaps, the empty team state, no context cards", async () => {
    renderApp("/route");
    await routeScenario("Delivery-mode challenge");

    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Infeasible$/);
    const gaps = within(screen.getByTestId("gaps-panel")).getAllByTestId("gap");
    expect(gaps).toHaveLength(3);
    for (const gap of gaps) expect(gap).toHaveTextContent("location");
    expect(screen.getByText("No verified builder fits this brief yet")).toBeInTheDocument();
    expect(screen.queryAllByTestId("builder-card")).toHaveLength(0);
    expect(screen.queryByTestId("ip-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cohort-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("partner-card")).not.toBeInTheDocument();
  });

  it("Budget challenge: the budget gap button pre-fills the chip with 370 and the re-computed route is Feasible", async () => {
    renderApp("/route");
    const user = await routeScenario("Budget challenge");

    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Partial$/);
    expect(screen.queryAllByTestId("builder-card")).toHaveLength(0);
    const gap = within(screen.getByTestId("gaps-panel")).getAllByTestId("gap")[0]!;
    expect(gap).toHaveTextContent("assembler.budget-fit");
    const raise = within(gap).getByRole("button", { name: "Raise daily budget to USD 370" });
    expect(raise).toBeEnabled();

    await user.click(raise);

    const form = await screen.findByRole("form", { name: "Venture brief" });
    expect(within(form).getByLabelText("Daily budget")).toHaveValue(370);
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await screen.findByTestId("status-badge")).toHaveTextContent(/^Feasible$/);
  });
});
