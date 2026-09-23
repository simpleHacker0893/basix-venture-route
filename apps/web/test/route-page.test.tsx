/**
 * Seam: rendered /route screen through React Testing Library (Sprint 002 #24).
 * `fetch` is the system boundary and the only thing faked; the real client parses every
 * response with the contract schemas.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { engineFetch, jsonResponse, renderApp } from "./fakeEngine";

describe("/route: scenario chips, banner, validation", () => {
  it("lists the five seed scenarios", async () => {
    renderApp("/route");

    await screen.findByRole("button", { name: "Load scenario: Health pilot" });
    expect(screen.getAllByRole("button", { name: /^Load scenario:/ })).toHaveLength(5);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the API-unreachable banner when the engine cannot be reached, never a blank screen", async () => {
    renderApp("/route", async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Use the form instead");
    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("shows the banner when a response does not match the contract", async () => {
    renderApp("/route", engineFetch({ scenarios: () => jsonResponse([{ id: "brief-x" }]) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use the form instead");
  });

  it("keeps a validation-error answer as a message, not a crash", async () => {
    renderApp(
      "/route",
      engineFetch({
        route: () =>
          jsonResponse({ type: "validation-error", message: "dailyBudget: Input should be greater than 0" }, 422),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
    await user.click(await screen.findByRole("button", { name: "Find my route" }));

    // The review screen maps the prefix to its field (#26); no engine-unreachable banner appears.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("id", "error-dailyBudget");
    expect(alert).toHaveTextContent("Input should be greater than 0");
    expect(screen.queryByText(/Use the form instead/)).not.toBeInTheDocument();
  });
});
