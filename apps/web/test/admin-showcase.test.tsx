/**
 * Seam: rendered screens through React Testing Library (D-19, spec #86 story 48-49, #106).
 * The Showcase tab on `/admin` lists pending Showcase entries: card preview, the four links as
 * plain text with the host highlighted (never a clickable anchor that auto-opens), the parsed
 * YouTube video id, and the "Project not yet confirmed" / "Account not confirmed" warnings.
 * Confirm and Reject post the decision and show `projectedRows`; a 409 ("Builder has withdrawn
 * this entry") removes the row after the queue refreshes. The Decided tab also reverses a
 * showcase decision (#49).
 */
import type { AdminDecision, DecidedQueue, AdminDecisionKind, PendingQueue, PendingShowcase } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";
import { fakeMarketplace } from "./fakeMarketplace";

const source = createOfflineSource();

const adminAuth: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  role: "admin",
  getToken: async () => "tok-admin",
  reload: async () => undefined,
  signOut: async () => undefined,
};

const SHOWCASE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function showcase(overrides: Partial<PendingShowcase> = {}): PendingShowcase {
  return {
    id: SHOWCASE_ID,
    builderId: "amara-osei",
    displayName: "Amara Osei",
    cohortId: "cohort-2026a",
    title: "Clinic Triage Copilot",
    description:
      "A MeTTa-routed intake flow that gets patients to the right clinician faster, built during the 2026a cohort sprint.",
    vertical: "health",
    licensable: true,
    skillIds: ["python", "rust"],
    liveUrl: "https://example.org/clinic/live",
    demoUrl: "https://demo.example.org/clinic",
    pitchVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
    pitchDeckUrl: "https://example.org/clinic/deck.pdf",
    pitchVideoId: "dQw4w9WgXcQ",
    showcaseStatus: "pending",
    projectStatus: "confirmed",
    accountConfirmed: true,
    submittedAt: "2026-09-21T09:00:00+03:00",
    demoData: true,
    ...overrides,
  };
}

function pending(overrides: Partial<PendingQueue> = {}): PendingQueue {
  return { accounts: [], credentials: [], projects: [], showcase: [showcase()], ...overrides };
}

function decidedEmpty(): DecidedQueue {
  return { accounts: [], credentials: [], projects: [], showcase: [] };
}

function decision(kind: AdminDecisionKind, id: string, status: AdminDecision["status"], projectedRows: number): AdminDecision {
  return { id, kind, status, projectedRows };
}

describe("/admin Showcase tab", () => {
  it("shows the tab count and the card preview with plain-text links and the parsed video id", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided: async () => decidedEmpty() });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    const tab = await screen.findByRole("tab", { name: "Showcase (1)" });
    await user.click(tab);

    const card = await screen.findByRole("article", { name: "Clinic Triage Copilot" });
    expect(within(card).getByText(/Amara Osei/)).toBeInTheDocument();
    expect(within(card).getByText(/Health/)).toBeInTheDocument();
    expect(within(card).getByText("Demo data")).toBeInTheDocument();
    expect(within(card).getByText(/gets patients to the right clinician/)).toBeInTheDocument();

    // Plain text, never a clickable anchor that auto-opens.
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(within(card).getAllByText("example.org", { exact: false }).length).toBeGreaterThan(0);
    expect(within(card).getByText("youtu.be", { exact: false })).toBeInTheDocument();
    expect(within(card).getByText("demo.example.org", { exact: false })).toBeInTheDocument();

    expect(within(card).getByText(/Video id:\s*dQw4w9WgXcQ/)).toBeInTheDocument();

    expect(within(card).queryByText("Project not yet confirmed")).not.toBeInTheDocument();
    expect(within(card).queryByText("Account not confirmed")).not.toBeInTheDocument();
  });

  it("warns when the project isn't confirmed and the account isn't confirmed", async () => {
    const marketplace = fakeMarketplace({
      getPending: async () => pending({ showcase: [showcase({ projectStatus: "pending", accountConfirmed: false })] }),
      getDecided: async () => decidedEmpty(),
    });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await userEvent.setup().click(await screen.findByRole("tab", { name: "Showcase (1)" }));
    const card = await screen.findByRole("article", { name: "Clinic Triage Copilot" });
    expect(within(card).getByText("Project not yet confirmed")).toBeInTheDocument();
    expect(within(card).getByText("Account not confirmed")).toBeInTheDocument();
  });

  it("confirms a showcase entry, removes the row and reports projected_rows", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(async (kind: AdminDecisionKind, id: string) => decision(kind, id, "confirmed", 74));
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided: async () => decidedEmpty(), confirm });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: "Showcase (1)" }));
    const card = await screen.findByRole("article", { name: "Clinic Triage Copilot" });
    await user.click(within(card).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("showcase", SHOWCASE_ID));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Clinic Triage Copilot" })).not.toBeInTheDocument());
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 74");
    expect(screen.getByRole("tab", { name: "Showcase (0)" })).toBeInTheDocument();
  });

  it("rejects a showcase entry with its kind and id", async () => {
    const user = userEvent.setup();
    const reject = vi.fn(async (kind: AdminDecisionKind, id: string) => decision(kind, id, "rejected", 40));
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided: async () => decidedEmpty(), reject });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: "Showcase (1)" }));
    const card = await screen.findByRole("article", { name: "Clinic Triage Copilot" });
    await user.click(within(card).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(reject).toHaveBeenCalledWith("showcase", SHOWCASE_ID));
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 40");
  });

  it("shows the withdrawn message on 409 and removes the row once the queue refreshes", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(async () => {
      throw new Error("The routing engine answered 409. Builder has withdrawn this entry");
    });
    const getPending = vi
      .fn()
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(pending({ showcase: [] }));
    const marketplace = fakeMarketplace({ getPending, getDecided: async () => decidedEmpty(), confirm });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: "Showcase (1)" }));
    const card = await screen.findByRole("article", { name: "Clinic Triage Copilot" });
    await user.click(within(card).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Builder has withdrawn this entry");
    await waitFor(() => expect(screen.queryByRole("article", { name: "Clinic Triage Copilot" })).not.toBeInTheDocument());
    await waitFor(() => expect(getPending).toHaveBeenCalledTimes(2));
  });

  it("lists a decided showcase row and reverses it", async () => {
    const user = userEvent.setup();
    const decidedShowcase: DecidedQueue = {
      accounts: [],
      credentials: [],
      projects: [],
      showcase: [{ ...showcase(), status: "confirmed", decidedAt: "2026-09-23T11:30:00+03:00" }],
    };
    const reject = vi.fn(async (kind: AdminDecisionKind, id: string) => decision(kind, id, "rejected", 33));
    const confirm = vi.fn();
    const marketplace = fakeMarketplace({
      getPending: async () => pending({ showcase: [] }),
      getDecided: async () => decidedShowcase,
      reject,
      confirm,
    });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: /Decided/ }));
    const row = await screen.findByRole("row", { name: /Clinic Triage Copilot/ });
    expect(within(row).getByTestId("status-pill")).toHaveTextContent("Confirmed");
    await user.click(within(row).getByRole("button", { name: "Reverse" }));

    await waitFor(() => expect(reject).toHaveBeenCalledWith("showcase", SHOWCASE_ID));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 33");
  });
});
