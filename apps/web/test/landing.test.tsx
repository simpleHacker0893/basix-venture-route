/**
 * Seam: rendered landing page (screen 1) through React Testing Library (Sprint 002 #31, D-36).
 * Sections, copy and links replicate the Stitch export design/stitch/batch-2/landing-page.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

describe("landing page (Stitch export)", () => {
  it("renders the Stitch sections in order with the calls to action wired to /route", () => {
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
    expect(within(hero).getByText("3/3 Grounded")).toBeInTheDocument();

    const how = screen.getByTestId("landing-section-how-it-works");
    expect(within(how).getByText("WORKFLOW")).toBeInTheDocument();
    expect(within(how).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "1. Describe your MVP in plain language",
      "2. Confirm the brief we extracted",
      "3. Get a route decided by MeTTa rules, with evidence",
    ]);
    for (const stage of ["Stage 01", "Stage 02", "Stage 03"]) expect(within(how).getByText(stage)).toBeInTheDocument();
    for (const foot of [
      "Plain language parsed into facts",
      "Deterministic constraint confirmation",
      "Zero hallucinations · Full audit ledger",
    ]) {
      expect(within(how).getByText(foot)).toBeInTheDocument();
    }

    const evidence = screen.getByTestId("landing-section-evidence");
    expect(within(evidence).getByText("DETERMINISTIC VERIFICATION")).toBeInTheDocument();
    expect(within(evidence).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Every recommendation names its rule and its facts.",
    );
    expect(within(evidence).getByText("RULE EVALUATION: verified-for-skill")).toBeInTheDocument();
    expect(within(evidence).getAllByTestId("fact")).toHaveLength(3);
    expect(within(evidence).getByText("!(eligible-builder brief-health-01 amina-otieno python)")).toBeInTheDocument();

    const builders = screen.getByTestId("landing-section-for-builders");
    expect(within(builders).getByText("ECOSYSTEM TALENT")).toBeInTheDocument();
    expect(within(builders).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Verified profile",
      "Bid where you are eligible",
    ]);
    for (const badge of ["Credential-backed", "Deterministic match"]) expect(within(builders).getByText(badge)).toBeInTheDocument();
    expect(within(builders).getByRole("link", { name: "Create a builder profile" })).toBeInTheDocument();
  });

  it("renders the Stitch header with the BASIX Edition badge and the primary actions", () => {
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByText("BASIX Edition")).toBeInTheDocument();
    for (const name of ["How it works", "Evidence", "For builders", "Sign in"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
  });

  it.each(["/", "/route", "/handoff"])("renders the Stitch footer with its three link columns on %s", (path) => {
    renderApp(path);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "Built for the BASIX hackathon, SingularityNET MeTTa track. All records are fictional demo data.",
    );
    const columns: Record<string, string[]> = {
      Product: ["How it works", "Evidence & rules", "For builders", "Demo scenarios"],
      Ecosystem: ["BASIX", "MeTTa OmniUniversity", "SingularityNET MeTTa", "Partners"],
      Account: ["Sign in", "Create a founder account", "Create a builder profile", "Admin"],
    };
    for (const [heading, links] of Object.entries(columns)) {
      const column = within(footer).getByRole("navigation", { name: heading });
      expect(within(column).getAllByRole("link").map((l) => l.textContent)).toEqual(links);
    }
    for (const name of ["PRD", "Privacy"]) {
      expect(within(footer).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(footer).toHaveTextContent("© 2026 Venture Route. Deterministic evaluation registry.");
  });
});
