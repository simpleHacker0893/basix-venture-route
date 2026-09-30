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
      route: { status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] },
      title: constrained.title,
      vertical: constrained.vertical,
      deliveryMode: constrained.deliveryMode,
      availabilityStart: constrained.availabilityStart,
      availabilityEnd: constrained.availabilityEnd,
      dailyBudget: constrained.dailyBudget,
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
      route: { status: "feasible", totalDailyRate: 370, builderIds: ["amina-otieno", "daniel-kiptoo", "grace-wambui"] },
      title: health.title,
      vertical: health.vertical,
      deliveryMode: health.deliveryMode,
      availabilityStart: health.availabilityStart,
      availabilityEnd: health.availabilityEnd,
      dailyBudget: health.dailyBudget,
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
      dayRate: 120,
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
  it("shows every tile from counts, the briefs-and-routes table, bids received and upcoming interviews", async () => {
    const marketplace = renderDashboard();

    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    expect(marketplace.getDashboard).toHaveBeenCalledTimes(1);
    const tiles = screen.getAllByTestId("tile");
    expect(tiles.map((tile) => tile.dataset.tile)).toEqual(["briefs", "routes", "openRequests", "bidsReceived", "bookings"]);
    expect(tiles.map((tile) => within(tile).getByTestId("tile-count").textContent)).toEqual(["2", "2", "1", "1", "2"]);
    expect(tiles[1]).toHaveTextContent("1 feasible · 1 partial · 0 infeasible");
    expect(screen.getByRole("link", { name: "New brief" })).toHaveAttribute("href", "/route");

    const table = screen.getByRole("table", { name: "Briefs and routes" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(constrained.title);
    expect(rows[0]).toHaveTextContent("Agri");
    expect(rows[0]).toHaveTextContent("Partial");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[0]).toHaveTextContent("USD 130 / day");
    expect(within(rows[0]!).getByText("Demo data")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Feasible");
    expect(rows[1]).toHaveTextContent("Closed");
    expect(rows[1]).toHaveTextContent("3");

    const bids = screen.getByRole("region", { name: "Bids received" });
    expect(bids).toHaveTextContent("Naomi Chebet");
    expect(bids).toHaveTextContent("USD 120 / day");
    expect(bids).toHaveTextContent(`for ${constrained.title}`);
    expect(within(bids).getByRole("link", { name: "Book interview" })).toHaveAttribute(
      "href",
      "/bookings/new?builder=naomi-chebet&request=r-constrained",
    );

    const interviews = screen.getByRole("region", { name: "Upcoming interviews" });
    const link = within(interviews).getByRole("link", { name: /Naomi Chebet/ });
    expect(link).toHaveAttribute("href", "/bookings/k-1");
    expect(interviews).toHaveTextContent("Fri 25 Sep 2026 · 09:00 EAT");
    expect(interviews).toHaveTextContent("Countered");
    expect(screen.getByText("Times are shown in Africa/Nairobi (UTC+3).")).toBeInTheDocument();
  });

  it("View route re-routes the stored brief through the engine and opens the route result", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });

    const table = screen.getByRole("table", { name: "Briefs and routes" });
    await user.click(within(table).getAllByRole("button", { name: "View route" })[0]!);

    expect(await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeInTheDocument();
    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Partial$/);
    expect(within(screen.getByTestId("team-section")).getByRole("heading", { level: 3 })).toHaveTextContent("Zawadi Njoroge");
  });

  it("renders the empty states", async () => {
    renderDashboard(empty);

    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    expect(screen.getAllByTestId("tile-count").map((el) => el.textContent)).toEqual(["0", "0", "0", "0", "0"]);
    expect(screen.getByText("No briefs published yet. Route a brief and publish it as a request.")).toBeInTheDocument();
    expect(screen.getByText("No bids yet.")).toBeInTheDocument();
    expect(screen.getByText("No interviews booked yet.")).toBeInTheDocument();
  });

  it("is behind the founder guard", async () => {
    renderDashboard(dashboard, builderAuth);

    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "Your ventures" })).not.toBeInTheDocument());
  });
});
