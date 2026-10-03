/**
 * Seam: rendered landing page (screen 1) through React Testing Library (Sprint 002 #31, D-36).
 * Sections and links keep the Stitch export's structure (design/stitch/batch-2/landing-page); copy
 * follows the refined UI (design/refined-ui, screen 01).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp } from "./fakeEngine";

describe("landing page (refined UI over the Stitch structure)", () => {
  it("renders the Stitch sections in order with the calls to action wired to /route", () => {
    renderApp("/");

    const sections = screen.getAllByTestId(/^landing-section-/).map((s) => s.dataset.section);
    expect(sections).toEqual(["hero", "how-it-works", "evidence", "for-builders", "hackathon-partners"]);

    const hero = screen.getByTestId("landing-section-hero");
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent("A founding team you can verify.");
    expect(within(hero).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
    expect(within(hero).getByRole("link", { name: "See a demo route" })).toHaveAttribute("href", "/route");
    expect(within(hero).getByText("Demo data")).toBeInTheDocument();
    expect(within(hero).getByText("Team USD 47 of 50 an hour")).toBeInTheDocument();
    expect(within(hero).getByText("A language model helps you write the brief. It never picks the people.")).toBeInTheDocument();
    for (const name of ["Amina Otieno", "Daniel Kiptoo", "Grace Wambui"]) expect(within(hero).getByText(name)).toBeInTheDocument();

    const how = screen.getByTestId("landing-section-how-it-works");
    expect(within(how).getByText("How it works")).toBeInTheDocument();
    expect(within(how).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Describe your MVP in plain language",
      "Confirm the brief we extracted",
      "Get a route decided by MeTTa rules, with evidence",
    ]);
    for (const stage of ["01", "02", "03"]) expect(within(how).getByText(stage)).toBeInTheDocument();
    for (const foot of [
      "Plain language parsed into facts",
      "python · ai-metta · ui-ux",
      "eligible-builder ⇐ source facts",
    ]) {
      expect(within(how).getByText(foot)).toBeInTheDocument();
    }

    const evidence = screen.getByTestId("landing-section-evidence");
    expect(within(evidence).getByText("For judges and founders alike")).toBeInTheDocument();
    expect(within(evidence).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Every recommendation names its rule and its facts.",
    );
    expect(within(evidence).getByText("reasoning-path · amina-otieno × python")).toBeInTheDocument();
    expect(within(evidence).getByText("verified-for-skill")).toBeInTheDocument();
    expect(within(evidence).getAllByTestId("fact")).toHaveLength(3);
    expect(within(evidence).getByText("!(eligible-builder brief-health-01 amina-otieno python)")).toBeInTheDocument();

    const builders = screen.getByTestId("landing-section-for-builders");
    expect(within(builders).getByText("For builders")).toBeInTheDocument();
    expect(within(builders).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Verified profile",
      "Bid where you are eligible",
    ]);
    for (const badge of ["Credential-backed", "Deterministic match"]) expect(within(builders).getByText(badge)).toBeInTheDocument();
    expect(within(builders).getByRole("link", { name: "Create a builder profile" })).toBeInTheDocument();
  });

  it("swaps the hero's Why panel to the builder whose Why is chosen, showing seed facts", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const hero = screen.getByTestId("landing-section-hero");

    const amina = within(hero).getByRole("button", { name: "Why Amina Otieno" });
    const daniel = within(hero).getByRole("button", { name: "Why Daniel Kiptoo" });
    expect(amina).toHaveAttribute("aria-expanded", "true");
    expect(daniel).toHaveAttribute("aria-expanded", "false");
    expect(within(hero).getByText("(earned amina-otieno cred-py-201)")).toBeInTheDocument();

    await user.click(daniel);
    expect(daniel).toHaveAttribute("aria-expanded", "true");
    expect(amina).toHaveAttribute("aria-expanded", "false");
    expect(within(hero).getByText("Why Daniel Kiptoo", { selector: "span" })).toBeInTheDocument();
    for (const fact of [
      "(earned daniel-kiptoo cred-metta-101)",
      "(available daniel-kiptoo 2026-09-22 2026-10-03)",
      "(supports-mode daniel-kiptoo hybrid)",
    ]) {
      expect(within(hero).getByText(fact)).toBeInTheDocument();
    }
    expect(within(hero).queryByText("(earned amina-otieno cred-py-201)")).not.toBeInTheDocument();
  });

  it("renders the header with the route mark wordmark and the primary actions", () => {
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Venture Route" })).toHaveAttribute("href", "/");
    for (const name of ["How it works", "Evidence", "For builders", "Sign in"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
  });

  it.each(["/", "/route", "/handoff"])("renders the Stitch footer with its three link columns on %s", (path) => {
    renderApp(path);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("A founding team you can verify. MeTTa rules decide, every match shows its evidence.");
    expect(within(footer).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
    expect(footer).toHaveTextContent(
      "Built for the BASIX hackathon, SingularityNET MeTTa track. Seed records are fictional demo data; hackathon partners are real organisations.",
    );
    const columns: Record<string, string[]> = {
      Product: ["How it works", "Evidence & rules", "For builders", "Demo scenarios"],
      Ecosystem: [
        "BASIX",
        "MeTTa OmniUniversity",
        "SingularityNET MeTTa",
        "Ecosystem partners (demo)",
        "Hackathon partners",
      ],
      Account: ["Sign in", "Create a founder account", "Create a builder profile", "Admin"],
    };
    for (const [heading, links] of Object.entries(columns)) {
      const column = within(footer).getByRole("navigation", { name: heading });
      expect(within(column).getAllByRole("link").map((l) => l.textContent)).toEqual(links);
    }
    for (const name of ["PRD", "Privacy"]) {
      expect(within(footer).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(footer).toHaveTextContent("© 2026 Venture Route");
  });
});
