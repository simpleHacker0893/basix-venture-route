/**
 * Seam: rendered landing page (screen 1) through React Testing Library (Sprint 002 #31).
 * The six sections and their copy come from prompt 2.1 of the Stitch pack.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

describe("landing page", () => {
  it("renders the six sections from the pack in order with the calls to action wired to /route", () => {
    renderApp("/");

    const sections = screen.getAllByTestId(/^landing-section-/).map((s) => s.dataset.section);
    expect(sections).toEqual(["hero", "how-it-works", "evidence", "for-builders"]);

    const hero = screen.getByTestId("landing-section-hero");
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(
      "The smallest credible route through BASIX.",
    );
    expect(within(hero).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
    expect(within(hero).getByRole("link", { name: "See a demo route" })).toHaveAttribute("href", "/route");
    expect(within(hero).getByText("Demo data")).toBeInTheDocument();

    const how = screen.getByTestId("landing-section-how-it-works");
    expect(within(how).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "1. Describe your MVP in plain language",
      "2. Confirm the brief we extracted",
      "3. Get a route decided by MeTTa rules, with evidence",
    ]);

    const evidence = screen.getByTestId("landing-section-evidence");
    expect(within(evidence).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Every recommendation names its rule and its facts.",
    );
    expect(within(evidence).getAllByTestId("fact")).toHaveLength(3);
    expect(within(evidence).getByText("eligible-builder")).toBeInTheDocument();

    const builders = screen.getByTestId("landing-section-for-builders");
    expect(within(builders).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Verified profile",
      "Bid where you are eligible",
    ]);
    expect(within(builders).getByRole("link", { name: "Create a builder profile" })).toBeInTheDocument();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "Built for the BASIX hackathon, SingularityNET MeTTa track. All records are fictional demo data.",
    );
    for (const name of ["GitHub", "PRD", "Privacy"]) {
      expect(within(footer).getByRole("link", { name })).toBeInTheDocument();
    }

    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const name of ["How it works", "Evidence", "For builders", "Sign in"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
  });
});
