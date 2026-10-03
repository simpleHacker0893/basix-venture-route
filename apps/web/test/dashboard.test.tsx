/**
 * Seam: the rendered /dashboard screen through React Testing Library (Sprint 004, #73; D-19).
 * Screen 11, converted from design/stitch/batch-4/founder-dashboard (D-36). One call to the
 * dashboard endpoint; the tiles map one-to-one onto `counts` (Must 4: "Founder dashboard tiles
 * match SQL counts"); "View route" re-routes the stored brief through the engine and opens the
 * route flow; upcoming interviews link to their booking with the engine's local time.
 */
import type { Dashboard } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createApiSource } from "../src/api/client";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { formatNairobi } from "../src/lib/nairobi";
import { engineFetch, SEED_BRIEFS } from "./fakeEngine";
import { fakeMarketplace } from "./fakeMarketplace";

const founderAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "founder",
  getToken: async () => "tok-founder",
  reload: async () => undefined,
  signOut: async () => undefined,
};
const builderAuth: AuthState = { ...founderAuth, role: "builder" };

const constrained = SEED_BRIEFS.find((brief) => brief.id === "brief-constrained-01")!;
const health = SEED_BRIEFS.find((brief) => brief.id === "brief-health-01")!;

const path = {
  rule: "eligible-builder" as const,
  facts: ["(confirmed admin-basix naomi-chebet)"],
  conclusion: "naomi-chebet is eligible for mobile with both evidence",
};

const dashboard: Dashboard = {
  counts: {
    briefs: 2,
    routes: { feasible: 1, partial: 1, infeasible: 0 },
    openRequests: 1,
    bidsReceived: 1,
    bookings: 2,
  },
  requests: [
    {
      id: "r-constrained",
      founderId: "user_founder",
      brief: constrained,
      route: { status: "partial", totalHourlyRate: 16, builderIds: ["zawadi-njoroge"] },
      title: constrained.title,
      vertical: constrained.vertical,
      deliveryMode: constrained.deliveryMode,
      availabilityStart: constrained.availabilityStart,
      availabilityEnd: constrained.availabilityEnd,
      hourlyBudget: constrained.hourlyBudget,
      routeStatus: "partial",
      status: "open",
      closedAt: null,
      createdAt: "2026-09-23T07:30:00Z",
      eligibility: null,
      demoData: true,
    },
    {
      id: "r-health",
      founderId: "user_founder",
      brief: health,
      route: { status: "feasible", totalHourlyRate: 47, builderIds: ["amina-otieno", "daniel-kiptoo", "grace-wambui"] },
      title: health.title,
      vertical: health.vertical,
      deliveryMode: health.deliveryMode,
      availabilityStart: health.availabilityStart,
      availabilityEnd: health.availabilityEnd,
      hourlyBudget: health.hourlyBudget,
      routeStatus: "feasible",
      status: "closed",
      closedAt: "2026-09-23T09:00:00Z",
      createdAt: "2026-09-22T07:30:00Z",
      eligibility: null,
      demoData: true,
    },
  ],
  bidsReceived: [
    {
      id: "b-1",
      requestId: "r-constrained",
      requestTitle: constrained.title,
      requestStatus: "open",
      builderId: "naomi-chebet",
      displayName: "Naomi Chebet",
      hourlyRate: 15,
      message: "The field survey app demonstrates mobile.",
      eligibleSkills: ["mobile"],
      path,
      status: "submitted",
      createdAt: "2026-09-23T08:00:00Z",
      demoData: true,
    },
  ],
  upcomingBookings: [
    {
      id: "k-1",
      requestId: "r-constrained",
      requestTitle: constrained.title,
      founderId: "user_founder",
      builderId: "naomi-chebet",
      displayName: "Naomi Chebet",
      state: "countered",
      proposedStart: "2026-09-25T06:00:00Z",
      proposedStartLocal: "2026-09-25T09:00:00+03:00",
      durationMin: 45,
      note: "",
      history: [],
      createdAt: "2026-09-23T08:30:00Z",
      demoData: true,
    },
  ],
};

const empty: Dashboard = {
  counts: { briefs: 0, routes: { feasible: 0, partial: 0, infeasible: 0 }, openRequests: 0, bidsReceived: 0, bookings: 0 },
  requests: [],
  bidsReceived: [],
  upcomingBookings: [],
};

function renderDashboard(data: Dashboard = dashboard, auth: AuthState = founderAuth) {
  const source = createApiSource("http://engine.test", engineFetch());
  const marketplace = fakeMarketplace({ getDashboard: vi.fn(async () => data) });
  render(<App initialPath="/dashboard" source={source} auth={auth} marketplace={marketplace} />);
  return marketplace;
}

describe("formatNairobi", () => {
  it("renders the engine's local string as day, date and EAT time without zone arithmetic", () => {
    expect(formatNairobi("2026-09-25T09:00:00+03:00")).toBe("Fri 25 Sep 2026 · 09:00 EAT");
    expect(formatNairobi("2026-10-06T18:00:00+03:00")).toBe("Tue 6 Oct 2026 · 18:00 EAT");
  });
});

describe("/dashboard", () => {
  it("shows the next step, each venture's pipeline, the bids to review, the interviews and the counts", async () => {
    const marketplace = renderDashboard();

    await screen.findByRole("heading", { level: 1, name: "Home" });
    expect(marketplace.getDashboard).toHaveBeenCalledTimes(1);
    const next = screen.getByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("You have 1 bid on");
    expect(within(next).getByRole("link", { name: /Review bids/ })).toHaveAttribute("href", "/dashboard#bids");
    expect(within(next).getByRole("link", { name: "Open this venture" })).toHaveAttribute("href", "/ventures/r-constrained");
    const tiles = screen.getAllByTestId("tile");
    expect(tiles.map((tile) => tile.dataset.tile)).toEqual(["ventures", "bids", "interviews"]);
    expect(tiles.map((tile) => within(tile).getByTestId("tile-count").textContent)).toEqual(["2", "1", "2"]);
    expect(tiles[0]).toHaveTextContent("Requests you published");
    expect(tiles[1]).toHaveTextContent("Builders who applied");
    expect(tiles[2]).toHaveTextContent("Confirmed or proposed");
    expect(screen.getAllByRole("link", { name: "Route a new venture" })[0]).toHaveAttribute("href", "/route");

    const list = screen.getByRole("list", { name: "Briefs and routes" });
    const rows = within(list).getAllByRole("listitem", { name: /./ }).filter((item) => item.parentElement === list);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(constrained.title);
    expect(rows[0]).toHaveTextContent("Partial");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[0]).toHaveTextContent("USD 38 an hour · Remote · 1 builder");
    expect(within(rows[0]!).getByText("Demo data")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Feasible");
    expect(rows[1]).toHaveTextContent("Closed");
    expect(rows[1]).toHaveTextContent("3 builders");
    expect(within(rows[0]!).getByRole("list", { name: `${constrained.title} progress` })).toHaveTextContent("Bids (1)");
    expect(within(rows[0]!).getByRole("link", { name: "Review bids" })).toHaveAttribute("href", "/ventures/r-constrained#bids");
    expect(within(rows[1]!).getByRole("link", { name: "Open venture" })).toHaveAttribute("href", "/ventures/r-health");

    const bids = screen.getByRole("region", { name: "Bids to review" });
    expect(within(bids).getByText("Builders who applied to work on your published request.")).toBeInTheDocument();
    expect(bids).toHaveTextContent("Naomi Chebet");
    expect(bids).toHaveTextContent("USD 15 an hour");
    expect(bids).not.toHaveTextContent("/ day");
    expect(bids).toHaveTextContent(`for ${constrained.title}`);
    expect(within(bids).getByRole("link", { name: "Propose interview" })).toHaveAttribute(
      "href",
      "/bookings/new?builder=naomi-chebet&request=r-constrained",
    );
    expect(within(bids).getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/builders/naomi-chebet");

    const interviews = screen.getByRole("region", { name: "Upcoming interviews" });
    const link = within(interviews).getByRole("link", { name: /Naomi Chebet/ });
    expect(link).toHaveAttribute("href", "/bookings/k-1");
    expect(interviews).toHaveTextContent("Fri 25 Sep 2026 · 09:00 EAT");
    expect(interviews).toHaveTextContent("Countered");
    expect(screen.getByText("Times are in Nairobi time.")).toBeInTheDocument();
  });

  it("View route re-routes the stored brief through the engine and opens the route result", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Home" });

    const list = screen.getByRole("list", { name: "Briefs and routes" });
    await user.click(within(list).getAllByRole("button", { name: "View route" })[0]!);

    expect(await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeInTheDocument();
    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Partial$/);
    expect(within(screen.getByTestId("team-section")).getByRole("heading", { level: 3 })).toHaveTextContent("Zawadi Njoroge");
  });

  it("shows the welcome card, how it works and the three empty cards on a first visit", async () => {
    renderDashboard(empty);

    await screen.findByRole("heading", { level: 1, name: "Home" });
    const welcome = screen.getByRole("region", { name: "Get started" });
    expect(welcome).toHaveTextContent("Describe your idea. Get the smallest credible route.");
    expect(within(welcome).getByRole("link", { name: /Route my venture/ })).toHaveAttribute("href", "/route");
    expect(within(welcome).getByRole("link", { name: "Try a demo brief" })).toHaveAttribute("href", "/route");

    const how = screen.getByRole("list", { name: "How it works" });
    expect(within(how).getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d/, ""))).toEqual([
      "Describe your ideaIn plain language, by chat or form.",
      "Confirm the briefSkills, dates, delivery mode, team size, budget.",
      "See your routeVerified builders, cost and any honest gaps.",
      "Publish and interviewBuilders bid. You book a time inside the app.",
    ]);
    expect(screen.getByRole("region", { name: "Ventures" })).toHaveTextContent("No ventures yet. Your published requests appear here.".replace("yet. ", "yet"));
    expect(screen.getByRole("region", { name: "Bids" })).toHaveTextContent("No bids yet");
    expect(screen.getByRole("region", { name: "Bids" })).toHaveTextContent("Builders who applied to your request show here.");
    expect(screen.getByRole("region", { name: "Interviews" })).toHaveTextContent("Nothing booked");
    expect(screen.getByRole("region", { name: "Interviews" })).toHaveTextContent("Proposed and confirmed times show here.");
    // The first visit replaces the working dashboard: no next-step card, tiles or venture list.
    expect(screen.queryByRole("region", { name: "Next step" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("tile")).not.toBeInTheDocument();
  });

  it("is behind the founder guard", async () => {
    renderDashboard(dashboard, builderAuth);

    await waitFor(() => expect(screen.queryByRole("region", { name: "Next step" })).not.toBeInTheDocument());
  });
});
