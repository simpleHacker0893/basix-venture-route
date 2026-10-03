/**
 * Seam: the founder's Home and venture page (design F1 to F4) through the full App with a fake
 * marketplace and the fake engine. The stage of each request is derived only from its status, bids
 * and bookings; the skills on a bid are the engine's `eligibleSkills`, rendered as returned.
 */
import type { Bid, Booking, Dashboard, Request } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createApiSource } from "../src/api/client";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import {
  currentStage,
  stageHints,
  stageStates,
  ventureView,
} from "../src/features/dashboard/ventureStage";
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

const health = SEED_BRIEFS.find((brief) => brief.id === "brief-health-01")!;
const agri = SEED_BRIEFS.find((brief) => brief.id === "brief-agri-01")!;

function request(id: string, brief: typeof health, overrides: Partial<Request> = {}): Request {
  return {
    id,
    founderId: "user_founder",
    brief,
    route: { status: "feasible", totalHourlyRate: 47, builderIds: ["amina-otieno", "daniel-kiptoo", "grace-wambui"] },
    title: brief.title,
    vertical: brief.vertical,
    deliveryMode: brief.deliveryMode,
    availabilityStart: brief.availabilityStart,
    availabilityEnd: brief.availabilityEnd,
    hourlyBudget: brief.hourlyBudget,
    routeStatus: "feasible",
    status: "open",
    closedAt: null,
    createdAt: "2026-09-22T07:30:00Z",
    eligibility: null,
    demoData: true,
    ...overrides,
  };
}

function bid(id: string, requestId: string, name: string, builderId: string, skills: Bid["eligibleSkills"], message = ""): Bid {
  return {
    id,
    requestId,
    requestTitle: requestId === "r-health" ? health.title : agri.title,
    requestStatus: "open",
    builderId,
    displayName: name,
    hourlyRate: 18,
    message,
    eligibleSkills: skills,
    path: { rule: "eligible-builder", facts: ["(confirmed admin-basix x)"], conclusion: "x is eligible" },
    status: "submitted",
    createdAt: "2026-09-23T08:00:00Z",
    demoData: true,
  };
}

function booking(id: string, requestId: string, state: Booking["state"]): Booking {
  return {
    id,
    requestId,
    requestTitle: health.title,
    founderId: "user_founder",
    builderId: "amina-otieno",
    displayName: "Amina Otieno",
    state,
    proposedStart: "2026-10-06T07:00:00Z",
    proposedStartLocal: "2026-10-06T10:00:00+03:00",
    durationMin: 30,
    note: "",
    history: [],
    createdAt: "2026-09-23T08:30:00Z",
    demoData: true,
  };
}

const counts = (c: Partial<Dashboard["counts"]> = {}): Dashboard["counts"] => ({
  briefs: 0,
  routes: { feasible: 0, partial: 0, infeasible: 0 },
  openRequests: 0,
  bidsReceived: 0,
  bookings: 0,
  ...c,
});

const withBids: Dashboard = {
  counts: counts({ openRequests: 2, bidsReceived: 3, bookings: 0 }),
  requests: [request("r-health", health, { createdAt: "2026-09-23T07:30:00Z" }), request("r-agri", agri, { createdAt: "2026-09-21T07:30:00Z", routeStatus: "partial", route: { status: "partial", totalHourlyRate: 31, builderIds: ["a", "b"] } })],
  bidsReceived: [
    bid("b-1", "r-health", "Amina Otieno", "amina-otieno", ["python", "backend"], "Available weekdays, remote."),
    bid("b-2", "r-health", "Brian Mwangi", "brian-mwangi", ["frontend", "ui-ux", "python"]),
    bid("b-3", "r-health", "Grace Wanjiru", "grace-wanjiru", ["python"]),
  ],
  upcomingBookings: [],
};

function renderAt(path: string, data: Dashboard | Error) {
  const source = createApiSource("http://engine.test", engineFetch());
  const getDashboard = vi.fn(async () => {
    if (data instanceof Error) throw data;
    return data;
  });
  const marketplace = fakeMarketplace({ getDashboard });
  render(<App initialPath={path} source={source} auth={founderAuth} marketplace={marketplace} />);
  return { getDashboard };
}

describe("ventureStage (derived only from status, bids and bookings)", () => {
  it("is Published while waiting for bids, Bids once one exists and Interview once a booking exists", () => {
    expect(currentStage(0, 0)).toBe(2);
    expect(currentStage(3, 0)).toBe(3);
    expect(currentStage(3, 1)).toBe(4);
    expect(currentStage(0, 1)).toBe(4);
    expect(stageStates(2)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(stageStates(3)).toEqual(["done", "done", "done", "current", "upcoming"]);
    expect(stageStates(4)).toEqual(["done", "done", "done", "done", "current"]);
  });

  it("matches bids and bookings to their request and picks the button for the stage", () => {
    const view = ventureView(withBids.requests[0]!, withBids.bidsReceived, []);
    expect(view.bids.map((b) => b.id)).toEqual(["b-1", "b-2", "b-3"]);
    expect(view.stageLabel).toBe("Bids");
    expect(view.stepNumber).toBe(4);
    expect(view.cta).toEqual({ label: "Review bids", to: "/ventures/r-health#bids" });
    const quiet = ventureView(withBids.requests[1]!, withBids.bidsReceived, []);
    expect(quiet.bids).toEqual([]);
    expect(quiet.stageLabel).toBe("Published");
    expect(quiet.cta).toEqual({ label: "Open venture", to: "/ventures/r-agri" });
    expect(stageHints(view)[3]).toBe("3 to review");
    expect(stageHints(quiet)[3]).toBe("No bids yet");
  });
});

describe("/dashboard with requests", () => {
  it("marks done, current and upcoming steps for each request's stage", async () => {
    renderAt("/dashboard", {
      ...withBids,
      upcomingBookings: [booking("k-1", "r-agri", "confirmed")],
    });

    await screen.findByRole("list", { name: "Briefs and routes" });
    const stepsOf = (title: string) =>
      within(screen.getByRole("list", { name: `${title} progress` })).getAllByRole("listitem");
    const health$ = stepsOf(health.title);
    expect(health$.map((li) => li.textContent?.match(/(done|current step|upcoming)$/)?.[0] ?? li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("current step")]),
    );
    expect(health$[0]).toHaveTextContent("done");
    expect(health$[1]).toHaveTextContent("done");
    expect(health$[2]).toHaveTextContent("done");
    expect(health$[3]).toHaveAttribute("aria-current", "step");
    expect(health$[3]).toHaveTextContent("Bids (3)");
    expect(health$[4]).toHaveTextContent("upcoming");
    const agri$ = stepsOf(agri.title);
    expect(agri$[4]).toHaveAttribute("aria-current", "step");
    expect(agri$[3]).toHaveTextContent("done");
  });

  it("renders each bid's eligibleSkills exactly as returned, with the profile and propose links", async () => {
    renderAt("/dashboard", withBids);

    const bids = await screen.findByRole("list", { name: "Bids" });
    const rows = within(bids).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    // Same skills, same order, nothing filtered or re-sorted.
    expect(rows[0]).toHaveTextContent(/Python.*Backend/);
    expect(rows[1]).toHaveTextContent(/Frontend.*UI\/UX design.*Python/);
    expect(rows[2]).toHaveTextContent("Python");
    expect(rows.map((r) => within(r).getByText(/Amina Otieno|Brian Mwangi|Grace Wanjiru/).textContent)).toEqual([
      "Amina Otieno",
      "Brian Mwangi",
      "Grace Wanjiru",
    ]);
    expect(within(rows[1]!).getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/builders/brian-mwangi");
    expect(within(rows[1]!).getByRole("link", { name: "Propose interview" })).toHaveAttribute(
      "href",
      "/bookings/new?builder=brian-mwangi&request=r-health",
    );
  });

  it("shows the latest route (status, builders, hourly rate) and opens the reasoning drawer from it", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard", withBids);

    const latest = await screen.findByRole("region", { name: "Latest route" });
    expect(latest).toHaveTextContent("Feasible");
    expect(latest).toHaveTextContent(health.title); // the most recent request by creation time
    expect(latest).toHaveTextContent("3");
    expect(latest).toHaveTextContent("USD 47");
    await user.click(within(latest).getByRole("button", { name: /Why this route\? See the rules and facts/ }));

    expect(await screen.findByRole("dialog", { name: "Why this route?" })).toBeInTheDocument();
  });

  it("hides a sidebar badge at 0 and shows the others from the counts", async () => {
    renderAt("/dashboard", { ...withBids, bidsReceived: [], counts: counts({ openRequests: 2, bidsReceived: 0, bookings: 1 }), upcomingBookings: [booking("k-1", "r-health", "proposed")] });

    const sections = await screen.findByRole("navigation", { name: "Sections" });
    await waitFor(() => expect(within(sections).getByRole("link", { name: /Ventures/ })).toHaveTextContent("2"));
    expect(within(sections).getByRole("link", { name: /Ventures/ })).toHaveTextContent(/Ventures\s*2/);
    expect(within(sections).getByRole("link", { name: "Bids" })).not.toHaveTextContent(/\d/);
    expect(within(sections).getByRole("link", { name: /Interviews/ })).toHaveTextContent(/Interviews\s*1/);
    expect(within(sections).getByRole("link", { name: /Route a venture/ })).toHaveAttribute("href", "/route");
    expect(within(sections).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("maps booking states to the founder's words", async () => {
    renderAt("/dashboard", { ...withBids, upcomingBookings: [booking("k-1", "r-health", "confirmed"), { ...booking("k-2", "r-health", "proposed"), displayName: "Brian Mwangi" }] });

    const interviews = await screen.findByRole("region", { name: "Upcoming interviews" });
    expect(interviews).toHaveTextContent("Confirmed");
    expect(interviews).toHaveTextContent("Waiting for builder");
    expect(interviews).toHaveTextContent("Tue 6 Oct 2026 · 10:00 EAT");
  });
});

describe("/dashboard errors and sidebar when empty", () => {
  it("keeps the page frame and shows the error in the main area when the dashboard call fails", async () => {
    renderAt("/dashboard", new Error("The routing engine answered 500."));

    expect(await screen.findByRole("alert")).toHaveTextContent("The routing engine answered 500.");
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Get started" })).not.toBeInTheDocument();
  });

  it("shows no badges on a first visit", async () => {
    renderAt("/dashboard", { counts: counts(), requests: [], bidsReceived: [], upcomingBookings: [] });

    await screen.findByRole("region", { name: "Get started" });
    const sections = screen.getByRole("navigation", { name: "Sections" });
    for (const name of ["Ventures", "Bids", "Interviews"]) {
      expect(within(sections).getByRole("link", { name })).not.toHaveTextContent(/\d/);
    }
  });
});

describe("/ventures/:requestId", () => {
  it("shows the progress timeline, the brief, the route result and the bids as cards", async () => {
    const user = userEvent.setup();
    renderAt("/ventures/r-health", withBids);

    expect(await screen.findByRole("heading", { level: 1, name: health.title })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Ventures" })).toHaveAttribute("href", "/dashboard#ventures");

    const progress = screen.getByRole("list", { name: "Progress" });
    const steps = within(progress).getAllByRole("listitem");
    expect(steps.map((li) => li.textContent?.replace(/(done|current step|upcoming)/, ""))).toEqual([
      expect.stringContaining("Brief confirmed"),
      expect.stringContaining("Route found"),
      expect.stringContaining("Published"),
      expect.stringContaining("Bids3 to review"),
      expect.stringContaining("Interview"),
    ]);
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).toHaveTextContent("Open to eligible builders");

    const brief = screen.getByRole("region", { name: "Brief" });
    expect(brief).toHaveTextContent("Hybrid");
    expect(brief).toHaveTextContent(`USD ${health.hourlyBudget} an hour`);
    expect(within(brief).getByRole("button", { name: "View route →" })).toBeInTheDocument();

    const strip = screen.getByRole("region", { name: "Route result" });
    expect(strip).toHaveTextContent("Feasible");
    expect(strip).toHaveTextContent("3 builders · USD 47 an hour");
    expect(within(strip).getByRole("button", { name: "Why this route? →" })).toBeInTheDocument();

    const bids = screen.getByRole("list", { name: "Bids" });
    const cards = within(bids).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Verified for");
    expect(cards[0]).toHaveTextContent(/Python.*Backend/);
    expect(cards[0]).toHaveTextContent("“Available weekdays, remote.”");
    expect(within(cards[0]!).getByRole("link", { name: "Propose interview" })).toHaveAttribute(
      "href",
      "/bookings/new?builder=amina-otieno&request=r-health",
    );
    expect(within(screen.getByRole("region", { name: "Bids" })).getByText("3 to review")).toBeInTheDocument();

    await user.click(within(brief).getByRole("button", { name: "View route →" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeInTheDocument();
  });

  it("highlights Ventures in the sidebar and says so when the venture does not exist", async () => {
    renderAt("/ventures/nope", withBids);

    expect(await screen.findByRole("region", { name: "Venture not found" })).toHaveTextContent("We couldn’t find this venture");
    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(within(sections).getByRole("link", { name: /Ventures/ })).toHaveAttribute("aria-current", "page");
  });

  it("shows an empty bids card when nobody has applied yet", async () => {
    renderAt("/ventures/r-agri", withBids);

    await screen.findByRole("heading", { level: 1, name: agri.title });
    expect(screen.getByText("Builders who applied to this request show here.")).toBeInTheDocument();
    expect(screen.queryByText(/to review/)).not.toBeInTheDocument();
  });
});
