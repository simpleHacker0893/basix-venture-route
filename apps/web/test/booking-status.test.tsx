/**
 * Seam: the rendered /bookings/:id screen through React Testing Library (Sprint 004, #75; D-19).
 * Screen 13, status and counter variants, from design/stitch/batch-4/interview-booking (D-36).
 * Both parties follow and act on a booking: the step bar and history come from `state` and
 * `history`, the action row from role and state, and the founder's Accept on a counter posts
 * `confirm`. A 409 renders the machine's reason and refreshes the booking.
 */
import type { Booking, BuilderProfile, Candidate } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiUnreachableError, createApiSource } from "../src/api/client";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { engineFetch } from "./fakeEngine";
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

const propose = {
  action: "propose" as const,
  actor: "founder" as const,
  state: "proposed" as const,
  proposedStart: "2026-09-24T07:30:00Z",
  proposedStartLocal: "2026-09-24T10:30:00+03:00",
  durationMin: 30 as const,
  note: "Intro call",
  at: "2026-09-23T08:30:00Z",
};
const counter = {
  action: "counter" as const,
  actor: "builder" as const,
  state: "countered" as const,
  proposedStart: "2026-09-25T06:00:00Z",
  proposedStartLocal: "2026-09-25T09:00:00+03:00",
  durationMin: 45 as const,
  note: "Morning suits me",
  at: "2026-09-23T09:00:00Z",
};
const accept = { ...propose, action: "accept" as const, actor: "builder" as const, state: "accepted" as const, at: "2026-09-23T09:10:00Z" };
const confirm = { ...counter, action: "confirm" as const, actor: "founder" as const, state: "confirmed" as const, at: "2026-09-23T09:30:00Z" };

function booking(state: Booking["state"], history: Booking["history"]): Booking {
  const latest = history[history.length - 1] ?? propose;
  return {
    id: "k-1",
    requestId: "r-1",
    requestTitle: "Constrained brief",
    founderId: "user_founder",
    builderId: "naomi-chebet",
    displayName: "Naomi Chebet",
    state,
    proposedStart: latest.proposedStart,
    proposedStartLocal: latest.proposedStartLocal,
    durationMin: latest.durationMin,
    note: latest.note,
    history,
    createdAt: "2026-09-23T08:30:00Z",
    demoData: true,
  };
}

const proposed = booking("proposed", [propose]);
const countered = booking("countered", [propose, counter]);
const accepted = booking("accepted", [propose, accept]);
const confirmed = booking("confirmed", [propose, counter, confirm]);

const availability = [{ start: "2026-09-22", end: "2026-10-20" }];
const candidate: Candidate = {
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  headline: "Mobile builder",
  cohortId: null,
  location: "Nairobi",
  dayRate: 120,
  modes: { remote: true, hybrid: false, onSite: false },
  availability,
  skills: [],
  projects: [],
  contact: { email: null, phone: null, linkedin: null },
  confirmed: true,
  demoData: true,
};
const profile: BuilderProfile = {
  ...candidate,
  selfDescribedSkills: [],
  contact: { email: "naomi@example.com", phone: null, linkedin: null },
  sharing: { email: true, phone: false, linkedin: false },
  accountStatus: "confirmed",
};

type Overrides = Parameters<typeof fakeMarketplace>[0];

function renderBooking(current: Booking | null, auth: AuthState, overrides: Overrides = {}) {
  const source = createApiSource("http://engine.test", engineFetch());
  const marketplace = fakeMarketplace({
    listMyBookings: vi.fn(async () => (current ? [current] : [])),
    getCandidate: vi.fn(async () => candidate),
    getProfile: vi.fn(async () => profile),
    ...overrides,
  });
  render(<App initialPath="/bookings/k-1" source={source} auth={auth} marketplace={marketplace} />);
  return marketplace;
}

function actionNames() {
  const row = screen.queryByRole("group", { name: "Actions" });
  return row ? within(row).getAllByRole("button").map((b) => b.textContent) : [];
}

describe("/bookings/:id action row by role and state", () => {
  it.each([
    ["builder", "proposed", proposed, builderAuth, ["Accept", "Counter"]],
    ["founder", "proposed", proposed, founderAuth, []],
    ["founder", "countered", countered, founderAuth, ["Accept", "Counter"]],
    ["builder", "countered", countered, builderAuth, []],
    ["founder", "accepted", accepted, founderAuth, ["Confirm"]],
    ["builder", "accepted", accepted, builderAuth, []],
    ["founder", "confirmed", confirmed, founderAuth, []],
    ["builder", "confirmed", confirmed, builderAuth, []],
  ] as const)("%s on %s", async (_role, _state, current, auth, expected) => {
    renderBooking(current, auth);

    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    expect(actionNames()).toEqual(expected);
  });
});

describe("/bookings/:id transitions", () => {
  it("builder Accept posts accept and the step bar moves to Accepted", async () => {
    const user = userEvent.setup();
    const acceptBooking = vi.fn(async () => accepted);
    renderBooking(proposed, builderAuth, { acceptBooking });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Proposed");

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(acceptBooking).toHaveBeenCalledWith("k-1"));
    expect(await screen.findByRole("listitem", { current: "step" })).toHaveTextContent("Accepted");
    expect(actionNames()).toEqual([]);
  });

  it("founder Accept on a counter posts confirm and the booking reads confirmed with three entries", async () => {
    const user = userEvent.setup();
    const confirmBooking = vi.fn(async () => confirmed);
    renderBooking(countered, founderAuth, { confirmBooking });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(confirmBooking).toHaveBeenCalledWith("k-1"));
    expect(await screen.findByRole("listitem", { current: "step" })).toHaveTextContent("Confirmed");
    const history = within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem");
    expect(history).toHaveLength(3);
    expect(history[0]).toHaveTextContent("Founder proposed");
    expect(history[0]).toHaveTextContent("Thu 24 Sep 2026 · 10:30 EAT");
    expect(history[1]).toHaveTextContent("Builder countered");
    expect(history[1]).toHaveTextContent("Fri 25 Sep 2026 · 09:00 EAT");
    expect(history[2]).toHaveTextContent("Founder confirmed");
    expect(actionNames()).toEqual([]);
  });

  it("founder Confirm on accepted posts confirm", async () => {
    const user = userEvent.setup();
    const confirmBooking = vi.fn(async () => booking("confirmed", [propose, accept, { ...accept, action: "confirm", actor: "founder", state: "confirmed" }]));
    renderBooking(accepted, founderAuth, { confirmBooking });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(confirmBooking).toHaveBeenCalledWith("k-1"));
  });

  it("Counter reuses the slot picker and posts the counter proposal", async () => {
    const user = userEvent.setup();
    const counterBooking = vi.fn(async () => countered);
    const marketplace = renderBooking(proposed, builderAuth, { counterBooking });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });

    await user.click(screen.getByRole("button", { name: "Counter" }));
    await waitFor(() => expect(marketplace.getProfile).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /September 25th, 2026/ }));
    await user.click(screen.getByRole("radio", { name: "09:00 EAT" }));
    await user.click(screen.getByRole("radio", { name: "45 min" }));
    await user.type(screen.getByRole("textbox", { name: "Notes to builder (optional)" }), "Morning suits me");
    await user.click(screen.getByRole("button", { name: "Send counter" }));

    await waitFor(() =>
      expect(counterBooking).toHaveBeenCalledWith("k-1", {
        proposedStart: "2026-09-25T09:00:00+03:00",
        durationMin: 45,
        note: "Morning suits me",
      }),
    );
    expect(await screen.findByText("Countered · awaiting the founder")).toBeInTheDocument();
  });

  it("a 409 shows the machine's reason and reloads the booking", async () => {
    const user = userEvent.setup();
    const acceptBooking = vi.fn(async () => {
      throw new ApiUnreachableError("The routing engine answered 409. the booking is confirmed; no further action is possible");
    });
    const listMyBookings = vi.fn(async () => [proposed]);
    renderBooking(proposed, builderAuth, { acceptBooking, listMyBookings });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    listMyBookings.mockResolvedValue([confirmed]);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("the booking is confirmed; no further action is possible");
    await waitFor(() => expect(listMyBookings).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("listitem", { current: "step" })).toHaveTextContent("Confirmed");
  });
});

describe("/bookings/:id access", () => {
  it("shows the not-found state to a user who is not a party", async () => {
    renderBooking(null, founderAuth);

    expect(await screen.findByText("This booking is not yours to see.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Interview with/ })).not.toBeInTheDocument();
  });

  it("is behind the founder-or-builder guard", async () => {
    renderBooking(proposed, { ...founderAuth, role: "admin" });

    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: /Interview with/ })).not.toBeInTheDocument());
  });
});
