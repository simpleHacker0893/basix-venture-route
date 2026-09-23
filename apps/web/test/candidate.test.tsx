/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 003 #46).
 * `/builders/:builderId` is driven through the full App with an injected founder auth state and a
 * fake marketplace API. The engine decides which contact keys are present (sharing toggles) and
 * every skill's `status` and `evidence`; the screen only renders what the API said.
 */
import { Candidate } from "@venture-route/contracts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiNotFoundError } from "../src/api/client";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { fakeMarketplace } from "./fakeMarketplace";

const source = createOfflineSource();

const founderAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "founder",
  getToken: async () => "tok-founder",
  reload: async () => undefined,
  signOut: async () => undefined,
};

const builderAuth: AuthState = { ...founderAuth, role: "builder", getToken: async () => "tok-builder" };

/** Parsed through the contract so an absent contact key reads as `null`, exactly as the client sees it. */
function candidate(contact: Record<string, string>): Candidate {
  return Candidate.parse({
    builderId: "jane-mwangi",
    displayName: "Jane Mwangi",
    headline: "Backend builder",
    cohortId: "cohort-2026a",
    location: "Nairobi",
    dayRate: 140,
    modes: { remote: true, hybrid: true, onSite: false },
    availability: [{ start: "2026-09-15", end: "2026-10-20" }],
    skills: [
      { id: "python", name: "Python", status: "verified", evidence: "both" },
      { id: "backend", name: "Backend", status: "verified", evidence: "project" },
      { id: "ui-ux", name: "UI/UX design", status: "self-described", evidence: null },
    ],
    projects: [
      {
        id: "8d0e1c2a-1111-4222-8333-444455556666",
        title: "Clinic triage intake flow",
        vertical: "health",
        licensable: true,
        completedOn: "2026-08-12",
        skillIds: ["python", "backend"],
        status: "confirmed",
        demoData: true,
      },
    ],
    contact,
    confirmed: true,
    demoData: true,
  });
}

describe("/builders/:builderId", () => {
  it("renders the shared email and LinkedIn only, the pills, the evidence badges and the confirmed project", async () => {
    const marketplace = fakeMarketplace({
      getCandidate: async () => candidate({ email: "jane@example.com", linkedin: "linkedin.com/in/jane-mwangi" }),
    });

    render(<App initialPath="/builders/jane-mwangi" source={source} auth={founderAuth} marketplace={marketplace} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Jane Mwangi" })).toBeInTheDocument();
    expect(screen.getByText("Confirmed by admin")).toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);

    const contact = screen.getByRole("region", { name: "Shared contact" });
    expect(within(contact).getByText("jane@example.com")).toBeInTheDocument();
    expect(within(contact).getByText("linkedin.com/in/jane-mwangi")).toBeInTheDocument();
    expect(within(contact).queryByText(/phone/i)).not.toBeInTheDocument();
    expect(within(contact).queryByText(/not shared/i)).not.toBeInTheDocument();

    const skills = screen.getByRole("list", { name: "Verified skills" });
    expect(within(within(skills).getByRole("listitem", { name: "Python" })).getByTestId("evidence-badge")).toHaveTextContent("Both");
    expect(within(within(skills).getByRole("listitem", { name: "Backend" })).getByTestId("evidence-badge")).toHaveTextContent(
      "Project",
    );
    const uiux = within(skills).getByRole("listitem", { name: "UI/UX design" });
    expect(within(uiux).getByText("Self-described · display only")).toBeInTheDocument();
    // The API derives the shape from the confirmed rows the engine projects (spec #35); it is not an engine report.
    expect(screen.queryByText(/as the engine reports them/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/same confirmed rows the engine projects/).length).toBeGreaterThan(0);
    expect(within(uiux).queryByTestId("evidence-badge")).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 3, name: "Clinic triage intake flow" })).toBeInTheDocument();
  });

  it("shows the not-shared state when the builder shares nothing", async () => {
    const marketplace = fakeMarketplace({ getCandidate: async () => candidate({}) });

    render(<App initialPath="/builders/jane-mwangi" source={source} auth={founderAuth} marketplace={marketplace} />);

    await screen.findByRole("heading", { level: 1, name: "Jane Mwangi" });
    const contact = screen.getByRole("region", { name: "Shared contact" });
    expect(within(contact).getByText(/not shared/i)).toBeInTheDocument();
    expect(within(contact).queryByText(/@/)).not.toBeInTheDocument();
  });

  it("explains a seed builder (404) and links back to the route", async () => {
    const marketplace = fakeMarketplace({
      getCandidate: async () => {
        throw new ApiNotFoundError("no confirmed builder amina-otieno");
      },
    });

    render(<App initialPath="/builders/amina-otieno" source={source} auth={founderAuth} marketplace={marketplace} />);

    const state = await screen.findByRole("region", { name: "Seed builder" });
    expect(state).toHaveTextContent(/seed builder/i);
    expect(state).toHaveTextContent("amina-otieno");
    expect(within(state).getByRole("link", { name: /Back to route/ })).toHaveAttribute("href", "/route");
  });

  it("sends a builder session to their own profile (RequireRole)", async () => {
    const marketplace = fakeMarketplace();

    render(<App initialPath="/builders/jane-mwangi" source={source} auth={builderAuth} marketplace={marketplace} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
  });
});
