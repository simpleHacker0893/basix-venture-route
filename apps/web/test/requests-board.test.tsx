/**
 * Seam: the rendered /requests board through React Testing Library (Sprint 004, #69; D-19).
 * Screen 10, converted from design/stitch/batch-4/requests-board (D-36). Driven through the full
 * App with an injected builder auth state and a fake MarketplaceApi: one call to the requests
 * list, the engine's verdict rendered on every card, the Bid button disabled with the reason as
 * its accessible description when `eligible-builder` does not hold.
 */
import type { BuilderProfile, Request } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  getToken: async () => "tok-builder",
  reload: async () => undefined,
  signOut: async () => undefined,
};
const founderAuth: AuthState = { ...builderAuth, role: "founder" };

const path = {
  rule: "eligible-builder" as const,
  facts: ["(confirmed admin-basix naomi-chebet)"],
  conclusion: "naomi-chebet is eligible for mobile with both evidence",
};

const NOT_ELIGIBLE = "eligible-builder does not hold for naomi-chebet on any of python, ai-metta, ui-ux.";
const GAP = "No verified builder for domain-research in the graph.";

type Sample = {
  id: string;
  title: string;
  vertical?: Request["vertical"];
  deliveryMode?: Request["deliveryMode"];
  availabilityStart?: string;
  availabilityEnd?: string;
  dailyBudget?: number;
  requiredSkills?: Request["brief"]["requiredSkills"];
  eligibility: Request["eligibility"];
  status?: Request["status"];
  closedAt?: string | null;
  createdAt: string;
};

function request(sample: Sample): Request {
  const brief: Request["brief"] = {
    id: `brief-${sample.id}`,
    title: sample.title,
    vertical: sample.vertical ?? "agri",
    requiredSkills: sample.requiredSkills ?? ["mobile", "rust"],
    maximumTeamSize: 2,
    availabilityStart: sample.availabilityStart ?? "2026-09-22",
    availabilityEnd: sample.availabilityEnd ?? "2026-10-06",
    deliveryMode: sample.deliveryMode ?? "remote",
    location: null,
    dailyBudget: sample.dailyBudget ?? 300,
    preferReusableIp: false,
    demoData: true,
  };
  return {
    id: sample.id,
    founderId: "user_founder",
    brief,
    route: { status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] },
    title: brief.title,
    vertical: brief.vertical,
    deliveryMode: brief.deliveryMode,
    availabilityStart: brief.availabilityStart,
    availabilityEnd: brief.availabilityEnd,
    dailyBudget: brief.dailyBudget,
    routeStatus: "partial",
    status: sample.status ?? "open",
    closedAt: sample.closedAt ?? null,
    createdAt: sample.createdAt,
    eligibility: sample.eligibility,
    demoData: true,
  };
}

const constrained = request({
  id: "r-constrained",
  title: "Constrained brief",
  eligibility: { eligible: true, skills: ["mobile"], path, reason: null },
  createdAt: "2026-09-23T07:30:00Z",
});
const health = request({
  id: "r-health",
  title: "Health pilot",
  vertical: "health",
  deliveryMode: "hybrid",
  availabilityEnd: "2026-09-29",
  dailyBudget: 400,
  requiredSkills: ["python", "ai-metta", "ui-ux"],
  eligibility: { eligible: false, skills: [], path: null, reason: NOT_ELIGIBLE },
  createdAt: "2026-09-23T09:00:00Z",
});
const agri = request({
  id: "r-agri",
  title: "Agri marketplace",
  availabilityEnd: "2026-10-20",
  dailyBudget: 350,
  requiredSkills: ["frontend", "backend", "domain-research"],
  eligibility: { eligible: false, skills: [], path: null, reason: GAP },
  createdAt: "2026-09-22T09:00:00Z",
});
const closed = request({
  id: "r-closed",
  title: "Closed one",
  status: "closed",
  closedAt: "2026-09-23T10:00:00Z",
  eligibility: { eligible: true, skills: ["mobile"], path, reason: null },
  createdAt: "2026-09-21T09:00:00Z",
});

const profile: BuilderProfile = {
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  headline: "Mobile builder",
  cohortId: null,
  location: "Nairobi",
  dayRate: 120,
  modes: { remote: true, hybrid: false, onSite: false },
  selfDescribedSkills: ["mobile"],
  contact: { email: "naomi@example.com", phone: null, linkedin: null },
  sharing: { email: true, phone: false, linkedin: false },
  availability: [{ start: "2026-09-22", end: "2026-10-20" }],
  skills: [{ id: "mobile", name: "Mobile", status: "verified", evidence: "both" }],
  accountStatus: "confirmed",
  confirmed: true,
  skillSet: [],
  suggestedSkills: [],
  githubUrl: null,
  linkedinUrl: null,
  demoData: true,
};

function renderBoard(requests: Request[] = [constrained, health, agri, closed], auth: AuthState = builderAuth) {
  const marketplace = fakeMarketplace({
    listRequests: vi.fn(async () => requests),
    getProfile: vi.fn(async () => profile),
  });
  render(<App initialPath="/requests" source={source} auth={auth} marketplace={marketplace} />);
  return marketplace;
}

function cards() {
  return screen.getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 2 }).textContent);
}

describe("/requests board", () => {
  it("renders every open request with the engine's verdict and the Bid button enabled only where it holds", async () => {
    const marketplace = renderBoard();

    expect(screen.getByText("Loading open requests…")).toBeInTheDocument();
    await screen.findByRole("heading", { level: 1, name: "Open requests" });
    expect(marketplace.listRequests).toHaveBeenCalledTimes(1);
    expect(screen.getByText("You can bid only where the eligible-builder rule holds for your profile.")).toBeInTheDocument();
    expect(screen.getByText(/Active builder profile: Naomi Chebet/)).toBeInTheDocument();

    const eligible = screen.getByRole("article", { name: "Constrained brief" });
    expect(within(eligible).getByTestId("verdict")).toHaveTextContent("Eligible · Mobile");
    expect(within(eligible).getByRole("button", { name: "Bid" })).toBeEnabled();
    expect(within(eligible).getByText("Demo data")).toBeInTheDocument();
    expect(within(eligible).getByText("22 Sep – 6 Oct 2026")).toBeInTheDocument();
    expect(within(eligible).getByText("Remote")).toBeInTheDocument();
    expect(within(eligible).getByText("USD 300 / day")).toBeInTheDocument();
    expect(within(eligible).getByText("brief-r-constrained")).toBeInTheDocument();

    const ineligible = screen.getByRole("article", { name: "Health pilot" });
    expect(within(ineligible).getByTestId("verdict")).toHaveTextContent(`Not eligible · ${NOT_ELIGIBLE}`);
    const bid = within(ineligible).getByRole("button", { name: "Bid" });
    expect(bid).toBeDisabled();
    expect(bid).toHaveAccessibleDescription(NOT_ELIGIBLE);
    expect(within(ineligible).getByText("Hybrid")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "All (4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eligible for me (1)" })).toBeInTheDocument();
  });

  it("filters with the chips and sorts client-side", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { level: 1, name: "Open requests" });
    expect(cards()).toEqual(["Health pilot", "Constrained brief", "Agri marketplace", "Closed one"]);

    await user.click(screen.getByRole("button", { name: "Eligible for me (1)" }));
    expect(cards()).toEqual(["Constrained brief"]);

    await user.click(screen.getByRole("button", { name: "All (4)" }));
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(cards()).toEqual(["Health pilot"]);
    await user.click(screen.getByRole("button", { name: "Health" }));

    const sort = screen.getByRole("combobox", { name: "Sort by" });
    await user.selectOptions(sort, "deadline");
    // Closed one and Constrained brief share the 2026-10-06 deadline; the tie breaks on title.
    expect(cards()).toEqual(["Health pilot", "Closed one", "Constrained brief", "Agri marketplace"]);
    await user.selectOptions(sort, "budget");
    expect(cards()).toEqual(["Health pilot", "Agri marketplace", "Closed one", "Constrained brief"]);
    await user.selectOptions(sort, "newest");
    expect(cards()).toEqual(["Health pilot", "Constrained brief", "Agri marketplace", "Closed one"]);
  });

  it("renders the empty state", async () => {
    renderBoard([]);

    expect(await screen.findByText("No open requests yet.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("is behind the builder guard", async () => {
    renderBoard([constrained], founderAuth);

    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "Open requests" })).not.toBeInTheDocument());
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
