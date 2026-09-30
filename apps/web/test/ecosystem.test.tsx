/**
 * Seam: rendered screens through React Testing Library (D-19, #79). The footer's Ecosystem and
 * Privacy links open real pages; the header's section links scroll the landing sections.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "./fakeEngine";

describe("footer links (#79)", () => {
  it("opens the ecosystem sites in a new tab and has no GitHub link", () => {
    renderApp("/");

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "BASIX" })).toHaveAttribute("href", "https://basix.market/");
    expect(within(footer).getByRole("link", { name: "MeTTa OmniUniversity" })).toHaveAttribute(
      "href",
      "https://basix.market/lms",
    );
    expect(within(footer).getByRole("link", { name: "SingularityNET MeTTa" })).toHaveAttribute(
      "href",
      "https://metta-lang.dev/",
    );
    for (const name of ["BASIX", "MeTTa OmniUniversity", "SingularityNET MeTTa"]) {
      const link = within(footer).getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
    expect(within(footer).getByRole("link", { name: "Partners" })).toHaveAttribute("href", "/partners");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).queryByRole("link", { name: "GitHub" })).not.toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "PRD" })).toBeInTheDocument();
  });
});

describe("/partners", () => {
  it("renders the seed partners, universities and licensable assets with Demo data pills", async () => {
    renderApp("/partners");

    expect(await screen.findByRole("heading", { level: 1, name: "Partners in the BASIX graph" })).toBeInTheDocument();
    const partners = screen.getByRole("region", { name: "Partners" });
    expect(within(partners).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "afya-plus",
      "amani-health",
      "elimu-education",
      "shamba-agri",
    ]);
    expect(within(partners).getAllByText("Health")).toHaveLength(2);
    expect(within(partners).getByText("Agri")).toBeInTheDocument();
    const universities = screen.getByRole("region", { name: "Universities and cohorts" });
    expect(within(universities).getByText("omni-university")).toBeInTheDocument();
    expect(within(universities).getByText("cohort-2026a")).toBeInTheDocument();
    const assets = screen.getByRole("region", { name: "Reusable IP" });
    expect(within(assets).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Afya Triage",
      "Elimu Quiz",
      "Shamba Records",
    ]);
    expect(screen.getAllByText("Demo data").length).toBeGreaterThanOrEqual(10);
  });
});

describe("/privacy", () => {
  it("states the demo-data and contact-sharing rules", () => {
    renderApp("/privacy");

    const main = within(screen.getByRole("main"));
    expect(main.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
    expect(main.getAllByText(/fictional demo data/i).length).toBeGreaterThan(0);
    expect(main.getByText(/sharing toggles/i)).toBeInTheDocument();
    expect(main.getAllByText(/Clerk/).length).toBeGreaterThan(0);
  });
});

describe("header section links", () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    scrollIntoView.mockClear();
  });

  it("scrolls the landing section into view from another route", async () => {
    renderApp("/route");
    const user = userEvent.setup();

    await user.click(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Evidence" }));

    const evidence = await screen.findByTestId("landing-section-evidence");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances.at(-1)).toBe(evidence);
  });
});
