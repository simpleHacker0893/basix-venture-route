/**
 * Seam: rendered handoff screen (screen 7) through React Testing Library (Sprint 002 #29).
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

async function routeHealthPilotAndOpenHandoff() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
  await user.click(await screen.findByRole("button", { name: "Find my route" }));
  await user.click(await screen.findByRole("link", { name: "Export handoff" }));
  await screen.findByRole("heading", { level: 1, name: "Venture handoff" });
  return user;
}

describe("handoff screen", () => {
  it("shows the plain-text handoff with copy and a named download", async () => {
    renderApp("/route");
    const user = await routeHealthPilotAndOpenHandoff();

    const text = screen.getByTestId("handoff-text");
    expect(text).toHaveTextContent("VENTURE ROUTE HANDOFF");
    expect(text).toHaveTextContent("TOTAL DAY RATE: USD 370 / day");
    const download = screen.getByRole("link", { name: "Download .txt" });
    expect(download).toHaveAttribute("download", "venture-route-brief-health-01.txt");
    expect(download.getAttribute("href")).toMatch(/^data:text\/plain;charset=utf-8,/);
    expect(screen.getByText("Demo data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    expect(await navigator.clipboard.readText()).toContain("VENTURE ROUTE HANDOFF");
  });

  it("points back to the route flow when there is no route yet", () => {
    renderApp("/handoff");

    expect(screen.getByRole("heading", { level: 1, name: "Venture handoff" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a route" })).toHaveAttribute("href", "/route");
    expect(screen.queryByTestId("handoff-text")).not.toBeInTheDocument();
  });
});
