/**
 * Seam: the BidDialog on the rendered /requests board through React Testing Library (Sprint 004,
 * #70; D-19). From an eligible card a builder submits a bid: the dialog pre-fills the profile day
 * rate, shows the founder's budget, takes an optional message, posts through MarketplaceApi and
 * on 201 closes and marks the card as bid. A 403 shows the engine's reason verbatim inside the
 * dialog, a 409 says closed or already bid, a 422 maps to the fields.
 */
import type { Bid, BuilderProfile, Request } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiForbiddenError, ApiUnreachableError, ApiValidationError } from "../src/api/client";
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

const path = {
  rule: "eligible-builder" as const,
  facts: ["(earned naomi-chebet cred-1a2b3c4d)", "(confirmed admin-basix naomi-chebet)"],
  conclusion: "naomi-chebet is eligible for mobile with both evidence",
};

const request: Request = {
  id: "r-constrained",
  founderId: "user_founder",
  brief: {
    id: "brief-constrained-01",
    title: "Constrained brief",
    vertical: "agri",
    requiredSkills: ["mobile", "rust"],
    maximumTeamSize: 2,
    availabilityStart: "2026-09-22",
    availabilityEnd: "2026-10-06",
    deliveryMode: "remote",
    location: null,
    dailyBudget: 300,
    preferReusableIp: false,
    demoData: true,
  },
  route: { status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] },
  title: "Constrained brief",
  vertical: "agri",
  deliveryMode: "remote",
  availabilityStart: "2026-09-22",
  availabilityEnd: "2026-10-06",
  dailyBudget: 300,
  routeStatus: "partial",
  status: "open",
  closedAt: null,
  createdAt: "2026-09-23T07:30:00Z",
  eligibility: { eligible: true, skills: ["mobile"], path, reason: null },
  demoData: true,
};

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

const placed: Bid = {
  id: "b-1",
  requestId: "r-constrained",
  requestTitle: "Constrained brief",
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
};

function renderBoard(postBid: ReturnType<typeof vi.fn>) {
  const marketplace = fakeMarketplace({
    listRequests: vi.fn(async () => [request]),
    getProfile: vi.fn(async () => profile),
    postBid: postBid as never,
  });
  render(<App initialPath="/requests" source={source} auth={builderAuth} marketplace={marketplace} />);
  return marketplace;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  const card = await screen.findByRole("article", { name: "Constrained brief" });
  await user.click(within(card).getByRole("button", { name: "Bid" }));
  return screen.getByRole("dialog", { name: "Bid on Constrained brief" });
}

describe("BidDialog", () => {
  it("pre-fills the profile day rate, shows the budget, posts and marks the card as bid", async () => {
    const user = userEvent.setup();
    const postBid = vi.fn(async () => placed);
    renderBoard(postBid);

    const dialog = await openDialog(user);
    const rate = within(dialog).getByRole("spinbutton", { name: "Your day rate (USD)" });
    expect(rate).toHaveValue(120);
    expect(within(dialog).getByText(/Founder max: USD 300 \/ day/)).toBeInTheDocument();
    expect(within(dialog).getByText("Your eligible skills: Mobile")).toBeInTheDocument();
    expect(within(dialog).getByText("(confirmed admin-basix naomi-chebet)")).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Message to founder (optional)" }),
      "The field survey app demonstrates mobile.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));

    await waitFor(() => expect(postBid).toHaveBeenCalledTimes(1));
    expect(postBid).toHaveBeenCalledWith("r-constrained", {
      dayRate: 120,
      message: "The field survey app demonstrates mobile.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const card = screen.getByRole("article", { name: "Constrained brief" });
    expect(within(card).getByText("Bid placed · USD 120 / day")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Bid placed" })).toBeDisabled();
  });

  it("shows a 403 reason verbatim inside the dialog and keeps it open", async () => {
    const user = userEvent.setup();
    const reason = "eligible-builder does not hold for naomi-chebet on any of mobile, rust.";
    const postBid = vi.fn(async () => {
      throw new ApiForbiddenError(reason);
    });
    renderBoard(postBid);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(reason);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Submit bid" })).toBeEnabled();
  });

  it.each([
    ["The routing engine answered 409. request closed", "This request is closed."],
    ["The routing engine answered 409. already bid", "You already bid on this request."],
  ])("maps a 409 (%s)", async (message, expected) => {
    const user = userEvent.setup();
    const postBid = vi.fn(async () => {
      throw new ApiUnreachableError(message);
    });
    renderBoard(postBid);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(expected);
  });

  it("maps a 422 to the fields", async () => {
    const user = userEvent.setup();
    const postBid = vi.fn(async () => {
      throw new ApiValidationError({
        type: "validation-error",
        message: "dayRate: Input should be greater than 0; message: String should have at most 1000 characters",
      });
    });
    renderBoard(postBid);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));

    expect(await within(dialog).findByText("Input should be greater than 0")).toBeInTheDocument();
    expect(within(dialog).getByText("String should have at most 1000 characters")).toBeInTheDocument();
    expect(within(dialog).getByRole("spinbutton", { name: "Your day rate (USD)" })).toHaveAccessibleDescription(
      /Input should be greater than 0/,
    );
  });

  it("rejects a non-positive or fractional day rate before posting (D-16)", async () => {
    const user = userEvent.setup();
    const postBid = vi.fn(async () => placed);
    renderBoard(postBid);

    const dialog = await openDialog(user);
    const rate = within(dialog).getByRole("spinbutton", { name: "Your day rate (USD)" });
    await user.clear(rate);
    await user.type(rate, "0");
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));
    expect(await within(dialog).findByText("Enter a whole number of USD per day, at least 1.")).toBeInTheDocument();

    await user.clear(rate);
    await user.type(rate, "12.5");
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));
    expect(within(dialog).getByText("Enter a whole number of USD per day, at least 1.")).toBeInTheDocument();
    expect(postBid).not.toHaveBeenCalled();
  });

  it("disables Submit while posting", async () => {
    const user = userEvent.setup();
    let resolve: (bid: Bid) => void = () => undefined;
    const postBid = vi.fn(
      () =>
        new Promise<Bid>((r) => {
          resolve = r;
        }),
    );
    renderBoard(postBid);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Submit bid" }));

    expect(within(dialog).getByRole("button", { name: "Submitting…" })).toBeDisabled();
    resolve(placed);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Cancel closes without posting", async () => {
    const user = userEvent.setup();
    const postBid = vi.fn(async () => placed);
    renderBoard(postBid);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(postBid).not.toHaveBeenCalled();
    expect(within(screen.getByRole("article", { name: "Constrained brief" })).getByRole("button", { name: "Bid" })).toBeEnabled();
  });
});
