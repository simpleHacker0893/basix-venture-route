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
    expect(within(form).getByLabelText("Daily budget")).toHaveValue(400);
    expect(within(form).getByRole("checkbox", { name: "Prefer reusable IP" })).toBeChecked();
  });

  it("renders the Zod error inline when the budget chip is edited to 0", async () => {
    renderApp("/route");
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.clear(within(form).getByLabelText("Daily budget"));
    await user.type(within(form).getByLabelText("Daily budget"), "0");
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    const budget = within(form).getByLabelText("Daily budget");
    expect(budget).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByRole("alert")).toHaveAttribute("id", "error-dailyBudget");
    expect(screen.queryByText("feasible")).not.toBeInTheDocument();
  });

  it("renders a server validation-error on the field named by the message prefix", async () => {
    renderApp(
      "/route",
      engineFetch({
        route: () =>
          jsonResponse({ type: "validation-error", message: "dailyBudget: Input should be greater than 0" }, 422),
      }),
    );
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    const alert = await within(form).findByRole("alert");
    expect(alert).toHaveAttribute("id", "error-dailyBudget");
    expect(alert).toHaveTextContent("Input should be greater than 0");
    expect(within(form).getByLabelText("Daily budget")).toHaveAttribute("aria-invalid", "true");
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

  it("re-computes the route with the edited budget: 250 turns the Health pilot partial", async () => {
    renderApp("/route");
    const user = userEvent.setup();
    const form = await openHealthPilotReview(user);

    await user.clear(within(form).getByLabelText("Daily budget"));
    await user.type(within(form).getByLabelText("Daily budget"), "250");
    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await screen.findByText("partial")).toBeInTheDocument();
  });
});
