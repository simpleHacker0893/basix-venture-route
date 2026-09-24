/**
 * Seam: RTL for Chloe's founder-wide toggle and read-aloud (Sprint 005a #102, spec #86 stories
 * 69-72; D-19). The fake voice provider and `fakeMarketplace` are injected through `renderApp`;
 * the real session, conductor and screens run. Chloe only reads what GET /api/me/dashboard and
 * the booking row say, never the founder's name (Q-22), and nothing she hears on these screens
 * can confirm, counter or change a booking.
 */
import type { Booking, Dashboard } from "@venture-route/contracts";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "../src/auth/authContext";
import { GREETING } from "../src/chloe/script";
import { createFakeVoiceProvider } from "../src/voice/fakeVoiceProvider";
import { selectProvider } from "../src/voice/selectProvider";
import { engineFetch, renderApp } from "./fakeEngine";
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
const adminAuth: AuthState = { ...founderAuth, role: "admin" };
const signedOut: AuthState = { ...founderAuth, isSignedIn: false, role: null };

const DASHBOARD_LINE = "You have 2 open requests, 3 bids, and an interview on Thursday 1 October at 10:30.";
const BOOKING_LINE = "Countered: Thursday 1 October at 10:30, 45 minutes.";

const counteredBooking: Booking = {
  id: "k-1",
  requestId: "r-1",
  requestTitle: "Field survey app",
  founderId: "user_founder",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  state: "countered",
  proposedStart: "2026-10-01T07:30:00Z",
  proposedStartLocal: "2026-10-01T10:30:00+03:00",
  durationMin: 45,
  note: "",
  history: [
    {
      action: "propose",
      actor: "founder",
      state: "proposed",
      proposedStart: "2026-09-30T06:00:00Z",
      proposedStartLocal: "2026-09-30T09:00:00+03:00",
      durationMin: 30,
      note: "",
      at: "2026-09-23T08:30:00Z",
    },
    {
      action: "counter",
      actor: "builder",
      state: "countered",
      proposedStart: "2026-10-01T07:30:00Z",
      proposedStartLocal: "2026-10-01T10:30:00+03:00",
      durationMin: 45,
      note: "",
      at: "2026-09-23T09:00:00Z",
    },
  ],
  createdAt: "2026-09-23T08:30:00Z",
  demoData: true,
};

const dashboard: Dashboard = {
  counts: { briefs: 2, routes: { feasible: 1, partial: 1, infeasible: 0 }, openRequests: 2, bidsReceived: 3, bookings: 2 },
  requests: [],
  bidsReceived: [],
  upcomingBookings: [
    counteredBooking,
    { ...counteredBooking, id: "k-2", proposedStart: "2026-10-05T07:30:00Z", proposedStartLocal: "2026-10-05T10:30:00+03:00" },
  ],
};

function founderMarketplace() {
  return fakeMarketplace({
    getDashboard: vi.fn(async () => dashboard),
    listMyBookings: vi.fn(async () => [counteredBooking]),
    postBooking: vi.fn(async () => counteredBooking),
    acceptBooking: vi.fn(async () => counteredBooking),
    counterBooking: vi.fn(async () => counteredBooking),
    confirmBooking: vi.fn(async () => counteredBooking),
  });
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

function navSwitch() {
  const nav = screen.getByRole("navigation", { name: "Primary" });
  return within(nav).queryByRole("switch", { name: "Voice: Chloe" });
}

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  Reflect.deleteProperty(window.navigator, "userActivation");
});

describe("the founder-wide Voice: Chloe toggle in the top nav", () => {
  it("is in the top nav and the mobile menu for a signed-in founder, and speaks the greeting once inside the click", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await settle();

    const toggle = navSwitch()!;
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(voice.spoken).toEqual([GREETING]);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    const mobileToggle = within(mobile).getByRole("switch", { name: "Voice: Chloe" });
    expect(mobileToggle).toHaveAttribute("aria-checked", "true");
    await user.click(mobileToggle);
    expect(navSwitch()).toHaveAttribute("aria-checked", "false");
    await user.click(navSwitch()!);
    // Once per session: turning voice back on does not greet again.
    expect(voice.spoken).toEqual([GREETING]);
  });

  it.each([
    ["a builder", builderAuth],
    ["an admin", adminAuth],
    ["a signed-out visitor", signedOut],
  ])("is absent for %s", async (_who, auth) => {
    renderApp("/privacy", engineFetch(), { voice: createFakeVoiceProvider(), auth, marketplace: fakeMarketplace() });
    await screen.findByRole("heading", { level: 1 });
    expect(navSwitch()).not.toBeInTheDocument();
  });

  it("is absent in offline mode and with VITE_VOICE_PROVIDER=off (no provider)", async () => {
    const offline = selectProvider("web", true);
    const off = selectProvider("off", false);
    expect(offline).toBeNull();
    expect(off).toBeNull();
    renderApp("/dashboard", engineFetch(), { voice: offline, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    expect(navSwitch()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });

  it("keeps one voice state across /dashboard, /bookings/:id and /route, shared with the intake switch", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(navSwitch()!);

    await user.click(screen.getAllByRole("link", { name: /Naomi Chebet/ })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    expect(navSwitch()).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("link", { name: "Back to your ventures" }));
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(screen.getByRole("link", { name: "New brief" }));
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });
    const switches = screen.getAllByRole("switch", { name: "Voice: Chloe" });
    expect(switches).toHaveLength(2);
    switches.forEach((s) => expect(s).toHaveAttribute("aria-checked", "true"));

    // The intake switch turns off the same session the top nav shows.
    await user.click(switches[1]!);
    expect(navSwitch()).toHaveAttribute("aria-checked", "false");
    expect(voice.spoken.filter((line) => line === GREETING)).toHaveLength(1);
  });

  it("the greeting from the top-nav switch on /route lands in the chat thread once", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Describe your MVP" });
    await user.click(navSwitch()!);
    expect(voice.spoken).toEqual([GREETING]);
    expect(screen.getAllByTestId("chloe-turn")).toHaveLength(1);
    expect(screen.getByTestId("chloe-turn")).toHaveTextContent(GREETING);
  });

  it("is remembered for the session across a reload", async () => {
    const user = userEvent.setup();
    const first = renderApp("/privacy", engineFetch(), { voice: createFakeVoiceProvider(), auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1 });
    await user.click(navSwitch()!);
    first.unmount();

    const voice = createFakeVoiceProvider();
    renderApp("/privacy", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(navSwitch()).toHaveAttribute("aria-checked", "true"));
    // No greeting without a click.
    expect(voice.spoken).toEqual([]);
  });
});

describe("dashboard read-aloud", () => {
  it("reads the counts and the next interview once on arrival and again on Read aloud", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/bookings/k-1", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    await user.click(navSwitch()!);
    await user.click(screen.getByRole("link", { name: "Back to your ventures" }));
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await settle();
    expect(voice.spoken).toEqual([GREETING, DASHBOARD_LINE]);

    await settle();
    expect(voice.spoken).toEqual([GREETING, DASHBOARD_LINE]);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await settle();
    expect(voice.spoken).toEqual([GREETING, DASHBOARD_LINE, DASHBOARD_LINE]);
  });

  it("reads nothing on arrival with voice off, and turning voice on only greets", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await settle();
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
    await user.click(navSwitch()!);
    await settle();
    expect(voice.spoken).toEqual([GREETING]);
  });

  it("with no interview says so, and pluralises from the counts", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({
      getDashboard: vi.fn(async () => ({
        ...dashboard,
        counts: { ...dashboard.counts, openRequests: 1, bidsReceived: 1 },
        upcomingBookings: [],
      })),
    });
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(navSwitch()!);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    await settle();
    expect(voice.spoken).toEqual([GREETING, "You have 1 open request, 1 bid, and no upcoming interviews."]);
  });

  it("does not speak on arrival after a reload until the page has had a user gesture", async () => {
    const user = userEvent.setup();
    const first = renderApp("/privacy", engineFetch(), { voice: createFakeVoiceProvider(), auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1 });
    await user.click(navSwitch()!);
    first.unmount();

    Object.defineProperty(window.navigator, "userActivation", { value: { hasBeenActive: false, isActive: false }, configurable: true });
    const voice = createFakeVoiceProvider();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await settle();
    expect(voice.spoken).toEqual([]);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    await settle();
    expect(voice.spoken).toEqual([DASHBOARD_LINE]);
  });

  it("shows Chloe is speaking with Stop Chloe, which empties the queue; leaving cancels speech", async () => {
    const fake = createFakeVoiceProvider({ holdUtterances: true });
    const cancelSpeech = vi.fn(() => fake.cancelSpeech());
    const voice = { ...fake, cancelSpeech };
    const user = userEvent.setup();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(navSwitch()!);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    expect(screen.getByText("Chloe is speaking")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stop Chloe" }));
    await settle();
    expect(screen.queryByText("Chloe is speaking")).not.toBeInTheDocument();
    // "Read aloud" restarts her (the held greeting is cut); Stop Chloe leaves nothing queued.
    expect(fake.spoken).toEqual([GREETING, DASHBOARD_LINE]);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    cancelSpeech.mockClear();
    await user.click(screen.getAllByRole("link", { name: /Naomi Chebet/ })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    expect(cancelSpeech).toHaveBeenCalled();
  });
});

describe("booking read-aloud", () => {
  it("reads the state and the latest proposal in Nairobi time once on arrival and on Read aloud", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(navSwitch()!);
    await user.click(screen.getAllByRole("link", { name: /Naomi Chebet/ })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    await settle();
    expect(voice.spoken).toEqual([GREETING, BOOKING_LINE]);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await settle();
    expect(voice.spoken).toEqual([GREETING, BOOKING_LINE, BOOKING_LINE]);
  });

  it("reads nothing to a builder on the same screen", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const first = renderApp("/privacy", engineFetch(), { voice: createFakeVoiceProvider(), auth: founderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1 });
    await user.click(navSwitch()!);
    first.unmount();

    renderApp("/bookings/k-1", engineFetch(), { voice, auth: builderAuth, marketplace: founderMarketplace() });
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    await settle();
    expect(voice.spoken).toEqual([]);
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });
});

describe("no voice commands on the founder screens", () => {
  it("shows no mic on /dashboard or /bookings/:id and no transcript triggers an API write", async () => {
    const voice = createFakeVoiceProvider();
    const user = userEvent.setup();
    const marketplace = founderMarketplace();
    renderApp("/dashboard", engineFetch(), { voice, auth: founderAuth, marketplace });
    await screen.findByRole("heading", { level: 1, name: "Your ventures" });
    await user.click(navSwitch()!);
    expect(screen.queryByTestId("mic-button")).not.toBeInTheDocument();
    act(() => voice.transcribe("confirm the booking"));

    await user.click(screen.getAllByRole("link", { name: /Naomi Chebet/ })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Interview with Naomi Chebet" });
    expect(screen.queryByTestId("mic-button")).not.toBeInTheDocument();
    act(() => voice.transcribe("yes accept it"));
    act(() => voice.transcribe("counter to Friday at nine"));
    await settle();

    expect(marketplace.postBooking).not.toHaveBeenCalled();
    expect(marketplace.acceptBooking).not.toHaveBeenCalled();
    expect(marketplace.counterBooking).not.toHaveBeenCalled();
    expect(marketplace.confirmBooking).not.toHaveBeenCalled();
  });
});

describe("the speaking indicator on the route result", () => {
  it("sits under the summary while Chloe speaks, and Stop Chloe empties the queue", async () => {
    const voice = createFakeVoiceProvider({ holdUtterances: true });
    const user = userEvent.setup();
    renderApp("/route", engineFetch(), { voice });
    await user.click(await screen.findByRole("switch", { name: "Voice: Chloe" }));
    await user.click(await screen.findByRole("button", { name: "Load scenario: Health pilot" }));
    await user.click(await screen.findByRole("button", { name: "Find my route" }));
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Feasible");

    const indicator = await screen.findByText("Chloe is speaking");
    const heading = screen.getByRole("heading", { level: 1, name: "Your route through BASIX" });
    expect(heading.closest("section")).toContainElement(indicator);
    const before = [...voice.spoken];
    await user.click(screen.getByRole("button", { name: "Stop Chloe" }));
    await settle();
    expect(screen.queryByText("Chloe is speaking")).not.toBeInTheDocument();
    expect(voice.spoken).toEqual(before);
  });
});
