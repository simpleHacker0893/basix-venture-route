/**
 * Seam: the builder's home at /home (design/refined-ui builder dashboard). It only reads existing
 * endpoints; a request shows as eligible only when the engine's verdict says so, otherwise with
 * the engine's own reason (AGENTS.md rule 1, D-45).
 */
import type { Bid, Booking, BuilderProfile, Credential, Request, ShowcaseProject, VentureBrief } from "@venture-route/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiNotFoundError } from "../src/api/client";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { fakeMarketplace } from "./fakeMarketplace";

const source = createOfflineSource();

const builderAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "builder",
  user: { name: "Amina Otieno", firstName: "Amina", email: "amina@example.com" },
  getToken: async () => "tok-builder",
  reload: async () => undefined,
  signOut: async () => undefined,
};

function profile(overrides: Partial<BuilderProfile> = {}): BuilderProfile {
  return {
    builderId: "amina-otieno",
    displayName: "Amina Otieno",
    headline: "Python and MeTTa builder",
    cohortId: "cohort-2026a",
    location: "Nairobi",
    dayRate: 120,
    modes: { remote: true, hybrid: true, onSite: false },
    selfDescribedSkills: [],
    contact: { email: "amina@example.com", phone: null, linkedin: null },
    sharing: { email: true, phone: false, linkedin: false },
    availability: [{ start: "2026-09-20", end: "2026-10-10" }],
    skills: [{ id: "python", name: "Python", status: "verified", evidence: "credential" }],
    accountStatus: "pending",
    confirmed: false,
    skillSet: ["FastAPI"],
    suggestedSkills: [],
    githubUrl: null,
    linkedinUrl: null,
    demoData: true,
    ...overrides,
  };
}

const credential: Credential = {
  id: "cred-py-201",
  title: "Python Programming Certificate",
  issuer: "Strathmore University",
  skillId: "python",
  issuedOn: null,
  credentialUrl: null,
  status: "pending",
  demoData: true,
};

const brief: VentureBrief = {
  id: "brief-health-01",
  title: "Health pilot",
  vertical: "health",
  requiredSkills: ["python"],
  maximumTeamSize: 3,
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-09-29",
  deliveryMode: "hybrid",
  location: null,
  dailyBudget: 400,
  preferReusableIp: false,
  demoData: true,
};

function request(eligibility: Request["eligibility"]): Request {
  return {
    id: "req-1",
    founderId: "founder-1",
    brief,
    route: { status: "feasible", totalDailyRate: 120, builderIds: ["amina-otieno"] },
    title: brief.title,
    vertical: "health",
    deliveryMode: "hybrid",
    availabilityStart: brief.availabilityStart,
    availabilityEnd: brief.availabilityEnd,
    dailyBudget: 400,
    routeStatus: "feasible",
    status: "open",
    closedAt: null,
    createdAt: "2026-09-23T08:00:00Z",
    eligibility,
    demoData: true,
  };
}

const bid: Bid = {
  id: "bid-1",
  requestId: "req-1",
  requestTitle: "Health pilot",
  requestStatus: "open",
  builderId: "amina-otieno",
  displayName: "Amina Otieno",
  dayRate: 120,
  message: "",
  eligibleSkills: ["python"],
  path: { rule: "eligible-builder", facts: [], conclusion: "eligible" },
  status: "submitted",
  createdAt: "2026-09-24T08:00:00Z",
  demoData: true,
};

const booking: Booking = {
  id: "bk-1",
  requestId: "req-1",
  requestTitle: "Health pilot",
  founderId: "founder-1",
  builderId: "amina-otieno",
  displayName: "Amina Otieno",
  state: "proposed",
  proposedStart: "2026-09-25T06:00:00Z",
  proposedStartLocal: "2026-09-25T09:00:00+03:00",
  durationMin: 30,
  note: "",
  history: [],
  createdAt: "2026-09-24T08:00:00Z",
  demoData: true,
};

function renderHome(overrides: Parameters<typeof fakeMarketplace>[0]) {
  const marketplace = fakeMarketplace({
    getProfile: async () => profile(),
    listCredentials: async () => [credential],
    listProjects: async (): Promise<ShowcaseProject[]> => [],
    listRequests: async () => [
      request({ eligible: false, skills: [], path: null, reason: "eligible-builder does not hold for amina-otieno on any of python." }),
    ],
    listMyBids: async () => [],
    listMyBookings: async () => [],
    ...overrides,
  });
  render(<App initialPath="/home" source={source} auth={builderAuth} marketplace={marketplace} />);
}

describe("/home (builder)", () => {
  it("shows an in-review builder their checklist, locked requests with the engine's reason, and empty bids", async () => {
    renderHome({});

    const next = await screen.findByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("2 / 4");
    expect(next).toHaveTextContent("BASIX is reviewing your account.");
    expect(within(next).getByRole("link", { name: "Add a project" })).toHaveAttribute("href", "/profile/projects/new");
    const progress = within(next).getByRole("list", { name: "Your progress" });
    expect(progress).toHaveTextContent("Confirmed by BASIX adminIn review");

    expect(screen.getByText("Bidding opens once you’re confirmed")).toBeInTheDocument();
    const bidButton = screen.getByRole("button", { name: "Place a bid · after review" });
    expect(bidButton).toBeDisabled();
    expect(bidButton).toHaveAccessibleDescription("eligible-builder does not hold for amina-otieno on any of python.");
    expect(screen.getByText("No bids yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing booked")).toBeInTheDocument();

    const evidence = screen.getByRole("region", { name: "Your evidence" });
    expect(evidence).toHaveTextContent("Python · Credential");
    expect(evidence).toHaveTextContent("Pending review");
    expect(evidence).toHaveTextContent("Self-described · not used for routing");
    expect(evidence).toHaveTextContent("FastAPI");
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("shows a confirmed builder the requests the engine says they are eligible for, with their bids and interviews", async () => {
    renderHome({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      listCredentials: async () => [{ ...credential, status: "confirmed" }],
      listRequests: async () => [request({ eligible: true, skills: ["python"], path: null, reason: null })],
      listMyBids: async () => [bid],
      listMyBookings: async () => [booking],
    });

    const next = await screen.findByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("4 / 4");
    expect(next).toHaveTextContent("You're eligible for 1 request.");
    expect(screen.getByRole("heading", { name: "Requests you're eligible for" })).toBeInTheDocument();
    expect(screen.getByText("Eligible: Python")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Place a bid" })).toHaveAttribute("href", "/requests");
    expect(screen.getByRole("region", { name: "My bids" })).toHaveTextContent("USD 120 / day · Sent");
    expect(screen.getByText("Requests you've applied to work on, and their status.")).toBeInTheDocument();
    const interviews = screen.getByRole("region", { name: "Upcoming interviews" });
    expect(within(interviews).getByRole("link", { name: "Health pilot" })).toHaveAttribute("href", "/bookings/bk-1");
    expect(interviews).toHaveTextContent("Fri 25 Sep 2026 · 09:00 EAT");
    expect(interviews).toHaveTextContent("Proposed");
  });

  it("asks a builder without a profile to complete it", async () => {
    const missing = async () => {
      throw new ApiNotFoundError("The routing engine answered 404.", { detail: "no profile yet" });
    };
    renderHome({ getProfile: missing, listCredentials: missing, listProjects: missing, listRequests: missing, listMyBids: missing });

    const next = await screen.findByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("0 / 4");
    expect(within(next).getByRole("link", { name: "Complete your profile" })).toHaveAttribute("href", "/profile");
  });

  it("collapses the sidebar to an icon rail, keeps each link's name, and remembers the choice", async () => {
    window.localStorage.removeItem("venture-route:sidebar-collapsed");
    renderHome({});
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: "Open requests" })).toHaveAttribute("title", "Open requests");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("venture-route:sidebar-collapsed")).toBe("1");

    cleanup();
    renderHome({});
    await user.click(await screen.findByRole("button", { name: "Expand sidebar" }));
    expect(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Open requests" }),
    ).not.toHaveAttribute("title");
    expect(window.localStorage.getItem("venture-route:sidebar-collapsed")).toBe("0");
  });
});

describe("/home (builder) loads in two stages", () => {
  it("shows the profile, bids and evidence while the open requests are still loading", async () => {
    let release: (list: Request[]) => void = () => undefined;
    const slow = new Promise<Request[]>((resolve) => {
      release = resolve;
    });
    renderHome({
      getProfile: async () => profile({ accountStatus: "confirmed", confirmed: true }),
      listCredentials: async () => [{ ...credential, status: "confirmed" }],
      listRequests: () => slow,
      listMyBids: async () => [bid],
    });

    const next = await screen.findByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("Checking open requests…");
    expect(screen.getByRole("region", { name: "My bids" })).toHaveTextContent("USD 120 / day · Sent");
    expect(screen.getByRole("region", { name: "Your evidence" })).toHaveTextContent("Python · Credential");
    expect(screen.getByText("Loading open requests…")).toBeInTheDocument();
    expect(screen.queryByText("Loading your home…")).not.toBeInTheDocument();

    release([request({ eligible: true, skills: ["python"], path: null, reason: null })]);

    expect(await screen.findByText("Eligible: Python")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent("You're eligible for 1 request.");
    expect(screen.queryByText("Loading open requests…")).not.toBeInTheDocument();
  });

  it("keeps the page when only the requests call fails, and says so in the requests section", async () => {
    renderHome({
      listRequests: async () => {
        throw new Error("The routing engine answered 500.");
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("The routing engine answered 500.");
    expect(screen.getByRole("region", { name: "Next step" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your evidence" })).toBeInTheDocument();
    expect(screen.queryByText("Your home could not be loaded.")).not.toBeInTheDocument();
  });
});
