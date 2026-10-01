/**
 * Seam: rendered landing page and footer through React Testing Library. The Hackathon partners
 * section lists REAL organisations from a hardcoded list; it is display only, so these tests also
 * pin that it stays apart from the fictional seed partners on /partners.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HACKATHON_PARTNERS } from "../src/features/landing/hackathonPartners";
import { renderApp } from "./fakeEngine";

describe("Hackathon partners section", () => {
  it("renders every partner with a url as an external link that opens safely in a new tab", () => {
    renderApp("/");
    const section = screen.getByTestId("landing-section-hackathon-partners");
    expect(within(section).getByRole("heading", { level: 2, name: "Built with the BASIX ecosystem." })).toBeInTheDocument();

    const withUrl = HACKATHON_PARTNERS.filter((partner) => partner.url);
    expect(withUrl).toHaveLength(9);
    for (const partner of withUrl) {
      const link = within(section).getByRole("link", { name: `${partner.name} (opens in a new tab)` });
      expect(link).toHaveAttribute("href", partner.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(within(section).getAllByRole("link")).toHaveLength(withUrl.length);
  });

  it("renders Blockwee, which has no url, as a plain card with no link", () => {
    renderApp("/");
    const section = screen.getByTestId("landing-section-hackathon-partners");
    const card = within(section).getByText("Blockwee").closest("li");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).queryByRole("link")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Media partners");
  });

  it("shows the domain on the second line when a partner has no role", () => {
    renderApp("/");
    const section = screen.getByTestId("landing-section-hackathon-partners");
    expect(within(section).getByText("singularitynet.io")).toBeInTheDocument();
    expect(within(section).getByText("xragency.org")).toBeInTheDocument();
    expect(within(section).getByText("rejuve.bio")).toBeInTheDocument();
    expect(within(section).getByText("Host, NFT infrastructure")).toBeInTheDocument();
  });

  it("carries no Demo data pill: these are real organisations", () => {
    renderApp("/");
    const section = screen.getByTestId("landing-section-hackathon-partners");
    expect(within(section).queryByText("Demo data")).not.toBeInTheDocument();
  });
});

describe("footer partner links", () => {
  it("separates the fictional seed partners from the real hackathon partners", () => {
    renderApp("/");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Ecosystem partners (demo)" })).toHaveAttribute("href", "/partners");
    expect(within(footer).getByRole("link", { name: "Hackathon partners" })).toHaveAttribute(
      "href",
      "/#hackathon-partners",
    );
  });
});
