/**
 * Seam: the pages the Stitch header and footer link to, rendered through React Testing Library
 * (D-36: every header and footer link lands on a real destination). The header's section links
 * scroll to the landing sections; the footer's Ecosystem links open /ecosystem sections built
 * from seed facts; Privacy opens /privacy.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderApp } from "./fakeEngine";

describe("header section links", () => {
  it("scroll to the landing section named by the hash", () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    renderApp("/#evidence");

    const evidence = screen.getByTestId("landing-section-evidence");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances).toContain(evidence);
  });

  it("point at the landing sections from every route", () => {
    renderApp("/route");

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how-it-works");
    expect(within(nav).getByRole("link", { name: "Evidence" })).toHaveAttribute("href", "/#evidence");
    expect(within(nav).getByRole("link", { name: "For builders" })).toHaveAttribute("href", "/#for-builders");
  });
});

describe("footer links", () => {
  it("open real pages: the ecosystem sections and the privacy page", () => {
    renderApp("/handoff");

    const footer = screen.getByRole("contentinfo");
    const ecosystem = within(footer).getByRole("navigation", { name: "Ecosystem" });
    expect(within(ecosystem).getByRole("link", { name: "BASIX" })).toHaveAttribute("href", "/ecosystem#basix");
    expect(within(ecosystem).getByRole("link", { name: "MeTTa OmniUniversity" })).toHaveAttribute(
      "href",
      "/ecosystem#omni",
    );
    expect(within(ecosystem).getByRole("link", { name: "SingularityNET MeTTa" })).toHaveAttribute(
      "href",
      "/ecosystem#snet",
    );
    expect(within(ecosystem).getByRole("link", { name: "Partners" })).toHaveAttribute("href", "/ecosystem#partners");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "PRD" })).toHaveAttribute(
      "href",
      "https://github.com/simpleHacker0893/basix-venture-route/blob/master/docs/PRD.md",
    );
  });
});

describe("/ecosystem", () => {
  it("renders the four sections from seed facts with the Demo data pill", () => {
    renderApp("/ecosystem");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The BASIX ecosystem");
    const sections = screen.getAllByTestId(/^ecosystem-section-/).map((s) => s.dataset.section);
    expect(sections).toEqual(["basix", "omni", "snet", "partners"]);
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);

    const omni = screen.getByTestId("ecosystem-section-omni");
    expect(within(omni).getByRole("heading", { level: 2 })).toHaveTextContent("MeTTa OmniUniversity");
    for (const university of ["Omni University", "Lakeside University", "Savanna Institute"]) {
      expect(within(omni).getByText(university)).toBeInTheDocument();
    }
    expect(within(omni).getByText("(cohort-of cohort-2026a omni-university)")).toBeInTheDocument();

    const snet = screen.getByTestId("ecosystem-section-snet");
    expect(within(snet).getByRole("heading", { level: 2 })).toHaveTextContent("SingularityNET MeTTa");
    for (const rule of [
      "verified-for-skill",
      "mode-compatible",
      "available-for-brief",
      "eligible-builder",
      "reuse-fit",
      "partner-fit",
      "route-gap",
    ]) {
      expect(within(snet).getByText(rule)).toBeInTheDocument();
    }

    const partners = screen.getByTestId("ecosystem-section-partners");
    expect(within(partners).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Amani Health",
      "Shamba Agri",
      "Elimu Education",
      "Afya Plus",
    ]);
    expect(within(partners).getByText("(partners-with afya-plus lakeside-university)")).toBeInTheDocument();
    expect(within(partners).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
  });

  it("scrolls to the section named by the hash", () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    renderApp("/ecosystem#partners");

    expect(scrollIntoView.mock.instances).toContain(screen.getByTestId("ecosystem-section-partners"));
  });
});

describe("/privacy", () => {
  it("states what the product stores and never claims more", () => {
    renderApp("/privacy");

    const main = within(screen.getByRole("main"));
    expect(main.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy");
    expect(main.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Demo data",
      "Routing without an account",
      "Accounts and profiles",
      "Requests, bids and interviews",
      "Keys and source",
    ]);
    expect(screen.getByText(/Every record in this release is fictional demo data/)).toBeInTheDocument();
    expect(screen.getByText(/shown to founders only when the builder turns sharing on/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/simpleHacker0893/basix-venture-route",
    );
  });
});
