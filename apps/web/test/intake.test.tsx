/**
 * Seam: rendered intake screen (screen 3) through React Testing Library (Sprint 002 #25).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { REQUIRED_FIELDS, renderApp } from "./fakeEngine";

describe("intake: chat, scenario chips, the form", () => {
  it("asks for every required field after a vague message, with template questions from the engine", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Reply to assistant"), "I want to build something for farmers");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const assistant = await screen.findByTestId("assistant-turn");
    expect(assistant).toHaveTextContent("To route this brief I still need:");
    expect(assistant.textContent?.match(/^- /gm) ?? assistant.querySelectorAll("li")).toHaveLength(REQUIRED_FIELDS.length);
    // The panel shows availabilityStart and availabilityEnd as one "Dates" chip (DESIGN.md).
    const panel = screen.getByRole("complementary", { name: "Your brief so far" });
    expect(within(panel).getAllByText("missing")).toHaveLength(REQUIRED_FIELDS.length - 1);
    expect(within(panel).getByText("Dates:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find my route" })).toBeDisabled();
    expect(screen.getByText("Demo data")).toBeInTheDocument();
  });

  it("loads a scenario into the review step, then routes it", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Confirm your brief" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Find my route" }));

    expect(await screen.findByText("feasible")).toBeInTheDocument();
  });

  it("routes the Agri marketplace values through the form path with the calendar range", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Use the form instead" }));
    const form = screen.getByRole("form", { name: "Venture brief" });
    await user.type(within(form).getByLabelText("Title"), "Agri marketplace");
    await user.click(within(form).getByRole("radio", { name: "Agri" }));
    for (const skill of ["Frontend", "Backend", "Domain research"]) {
      await user.click(within(form).getByRole("checkbox", { name: skill }));
    }
    await user.clear(within(form).getByLabelText("Maximum team size"));
    await user.type(within(form).getByLabelText("Maximum team size"), "3");
    await user.click(within(form).getByRole("button", { name: /Availability/ }));
    // Two months side by side: October's grid repeats September's last days as outside days.
    await user.click((await screen.findAllByRole("button", { name: /September 22nd, 2026/ }))[0]!);
    await user.click(screen.getAllByRole("button", { name: /September 29th, 2026/ })[0]!);
    await user.keyboard("{Escape}");
    await user.click(within(form).getByRole("radio", { name: "Remote" }));
    await user.clear(within(form).getByLabelText("Daily budget"));
    await user.type(within(form).getByLabelText("Daily budget"), "350");
    await user.click(within(form).getByRole("checkbox", { name: "Prefer reusable IP" }));
    expect(within(form).getByRole("button", { name: /Availability/ })).toHaveTextContent("22 Sep – 29 Sep 2026");

    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await screen.findByText("feasible")).toBeInTheDocument();
    // The engine lists the team in builder-id order; the chat path shows the same order (#32).
    expect(screen.getByText("fatuma-hassan, lucy-achieng, wanjiru-mwangi")).toBeInTheDocument();
  });

  it("keeps the location field for on-site only and refuses to submit an invalid form", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Use the form instead" }));
    const form = screen.getByRole("form", { name: "Venture brief" });
    expect(within(form).getByLabelText("Location")).toBeDisabled();
    await user.click(within(form).getByRole("radio", { name: "On-site" }));
    expect(within(form).getByLabelText("Location")).toBeEnabled();

    await user.click(within(form).getByRole("button", { name: "Find my route" }));

    expect(await within(form).findAllByRole("alert")).not.toHaveLength(0);
    expect(screen.queryByText("feasible")).not.toBeInTheDocument();
  });
});
