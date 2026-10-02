/**
 * Seam: rendered review screen (screen 4) through React Testing Library (Sprint 002 #26).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { engineFetch, jsonResponse, renderApp } from "./fakeEngine";

async function openHealthPilotReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
  await screen.findByRole("heading", { level: 1, name: "Confirm your brief" });
  return screen.getByRole("form", { name: "Venture brief" });
}

describe("review: editable chips with inline errors", () => {
  it("pre-fills every field from the loaded scenario", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    const form = await openHealthPilotReview(user);

    expect(within(form).getByLabelText("Title")).toHaveValue("Health pilot: triage assistant for community clinics");
    expect(within(form).getByRole("radio", { name: "Health" })).toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "AI / MeTTa" })).toBeChecked();
    expect(within(form).getByLabelText("Maximum team size")).toHaveValue(3);
    expect(within(form).getByRole("button", { name: /Availability/ })).toHaveTextContent("22 Sep – 29 Sep 2026");
    expect(within(form).getByRole("radio", { name: "Hybrid" })).toBeChecked();
    expect(within(form).getByLabelText("Budget per hour (USD)")).toHaveValue(50);
    expect(within(form).getByRole("checkbox", { name: "Prefer reusable IP" })).toBeChecked();
  });

  it("renders the Zod error inline when the budget chip is edited to 0", async () => {
    renderApp("/route");
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.clear(within(form).getByLabelText("Budget per hour (USD)"));
    await user.type(within(form).getByLabelText("Budget per hour (USD)"), "0");
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    const budget = within(form).getByLabelText("Budget per hour (USD)");
    expect(budget).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByRole("alert")).toHaveAttribute("id", "error-hourlyBudget");
    expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
  });

  it("renders a server validation-error on the field named by the message prefix", async () => {
    renderApp(
      "/route",
      engineFetch({
        route: () =>
          jsonResponse({ type: "validation-error", message: "hourlyBudget: Input should be greater than or equal to 1" }, 422),
      }),
    );
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    const alert = await within(form).findByRole("alert");
    expect(alert).toHaveAttribute("id", "error-hourlyBudget");
    expect(alert).toHaveTextContent("Input should be greater than or equal to 1");
    expect(within(form).getByLabelText("Budget per hour (USD)")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a server message without a field prefix at the top of the form", async () => {
    renderApp(
      "/route",
      engineFetch({
        route: () => jsonResponse({ type: "validation-error", message: "Something about the whole brief" }, 422),
      }),
    );
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await within(form).findByRole("alert")).toHaveAttribute("id", "error-form");
  });

  it("rejects an hourly budget above 250 inline, before any request (D-59)", async () => {
    renderApp("/route");
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.clear(within(form).getByLabelText("Budget per hour (USD)"));
    await user.type(within(form).getByLabelText("Budget per hour (USD)"), "251");
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(within(form).getByLabelText("Budget per hour (USD)")).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByRole("alert")).toHaveAttribute("id", "error-hourlyBudget");
    expect(screen.queryByTestId("status-badge")).not.toBeInTheDocument();
  });

  it("re-computes the route with the edited budget: 31 turns the Health pilot partial", async () => {
    renderApp("/route");
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.clear(within(form).getByLabelText("Budget per hour (USD)"));
    await user.type(within(form).getByLabelText("Budget per hour (USD)"), "31");
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Partial");
  });
});
