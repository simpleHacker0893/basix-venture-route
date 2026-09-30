/**
 * Seam: the rendered /bookings/new screen through React Testing Library (Sprint 004, #74; D-19).
 * Screen 13, propose variant, from design/stitch/batch-4/interview-booking (D-36). A founder
 * picks a day inside the builder's confirmed availability, a 30-minute start between 08:00 and
 * 18:00 EAT, 30 or 45 minutes and a note; the proposal is sent with the start as an ISO string
 * carrying the +03:00 offset, so the browser does no zone arithmetic (D-16).
 */
import type { Booking, Candidate } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiNotFoundError, ApiValidationError, createApiSource } from "../src/api/client";
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

const candidate: Candidate = {
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  headline: "Mobile builder",
  cohortId: null,
  location: "Nairobi",
  dayRate: 120,
  modes: { remote: true, hybrid: false, onSite: false },
  availability: [{ start: "2026-09-22", end: "2026-10-20" }],
  skills: [{ id: "mobile", name: "Mobile", status: "verified", evidence: "both" }],
  projects: [],
  contact: { email: "naomi@example.com", phone: null, linkedin: null },
  confirmed: true,
  demoData: true,
};

const created: Booking = {
  id: "k-1",
  requestId: "r-1",
  requestTitle: "Constrained brief",
  founderId: "user_founder",
  builderId: "naomi-chebet",
  displayName: "Naomi Chebet",
  state: "proposed",
  proposedStart: "2026-09-24T07:30:00Z",
  proposedStartLocal: "2026-09-24T10:30:00+03:00",
  durationMin: 45,
  note: "Intro call",
  history: [],
  createdAt: "2026-09-23T08:30:00Z",
  demoData: true,
};

function renderPropose(
  postBooking: ReturnType<typeof vi.fn> = vi.fn(async () => created),
  getCandidate: ReturnType<typeof vi.fn> = vi.fn(async () => candidate),
  auth: AuthState = founderAuth,
  path = "/bookings/new?builder=naomi-chebet&request=r-1",
) {
  const source = createApiSource("http://engine.test", engineFetch());
  const marketplace = fakeMarketplace({ getCandidate: getCandidate as never, postBooking: postBooking as never });
  render(<App initialPath={path} source={source} auth={auth} marketplace={marketplace} />);
  return marketplace;
}

describe("/bookings/new", () => {
  it("disables days outside availability, offers the 30-minute grid 08:00 to 18:00 EAT, posts and navigates", async () => {
    const user = userEvent.setup();
    const postBooking = vi.fn(async () => created);
    renderPropose(postBooking);

    await screen.findByRole("heading", { level: 1, name: "Book an interview with Naomi Chebet" });
    expect(screen.getByText("Times are shown in Africa/Nairobi.")).toBeInTheDocument();
    expect(screen.getByText("Builder verified availability window: 22 Sep – 20 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /September 21st, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /September 22nd, 2026/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /September 24th, 2026/ })).toBeEnabled();

    const grid = screen.getByRole("group", { name: "Start time" });
    const starts = within(grid).getAllByRole("radio").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(starts).toHaveLength(21);
    expect(starts[0]).toBe("08:00 EAT");
    expect(starts[1]).toBe("08:30 EAT");
    expect(starts[20]).toBe("18:00 EAT");
    expect(starts).not.toContain("07:30 EAT");
    expect(starts).not.toContain("18:30 EAT");

    await user.click(screen.getByRole("button", { name: /September 24th, 2026/ }));
    await user.click(within(grid).getByRole("radio", { name: "10:30 EAT" }));
    await user.click(screen.getByRole("radio", { name: "45 min" }));
    await user.type(screen.getByRole("textbox", { name: "Notes to builder (optional)" }), "Intro call");
    expect(screen.getByTestId("summary")).toHaveTextContent("Thu 24 Sep 2026 · 10:30 – 11:15 EAT");
    expect(screen.getByTestId("summary")).toHaveTextContent("Mobile builder");

    await user.click(screen.getByRole("button", { name: "Send proposal" }));

    await waitFor(() => expect(postBooking).toHaveBeenCalledTimes(1));
    expect(postBooking).toHaveBeenCalledWith({
      builderId: "naomi-chebet",
      requestId: "r-1",
      proposedStart: "2026-09-24T10:30:00+03:00",
      durationMin: 45,
      note: "Intro call",
    });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 1, name: "Book an interview with Naomi Chebet" })).not.toBeInTheDocument(),
    );
  });

  it("needs a day and a start before sending, and renders a 422 reason inline", async () => {
    const user = userEvent.setup();
    const postBooking = vi.fn(async () => {
      throw new ApiValidationError({
        type: "validation-error",
        message: "proposedStart: start is outside the builder's confirmed availability (2026-11-02 is in no range)",
      });
    });
    renderPropose(postBooking);
    await screen.findByRole("heading", { level: 1, name: "Book an interview with Naomi Chebet" });

    await user.click(screen.getByRole("button", { name: "Send proposal" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a day and a start time first.");
    expect(postBooking).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /September 24th, 2026/ }));
    await user.click(screen.getByRole("radio", { name: "08:00 EAT" }));
    await user.click(screen.getByRole("button", { name: "Send proposal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "start is outside the builder's confirmed availability (2026-11-02 is in no range)",
    );
    expect(screen.getByRole("button", { name: "Send proposal" })).toBeEnabled();
  });

  it("renders the not-found state for a builder without a confirmed account", async () => {
    renderPropose(
      vi.fn(async () => created),
      vi.fn(async () => {
        throw new ApiNotFoundError();
      }),
      founderAuth,
      "/bookings/new?builder=amina-otieno",
    );

    expect(await screen.findByText("This builder has no confirmed account to book yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send proposal" })).not.toBeInTheDocument();
  });

  it("is behind the founder guard", async () => {
    renderPropose(vi.fn(async () => created), vi.fn(async () => candidate), builderAuth);

    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 1, name: /Book an interview/ })).not.toBeInTheDocument(),
    );
  });
});
