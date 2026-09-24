/**
 * Seam: rendered screens through React Testing Library (D-19, spec #35 story 24, #49).
 * The Decided tab on `/admin` lists confirmed and rejected rows; Reverse posts the opposite
 * decision, the engine reprojects and answers `projectedRows`, and the screen shows that number.
 */
import type { AdminDecision, AdminDecisionKind, DecidedQueue, PendingQueue } from "@venture-route/contracts";
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

const CREDENTIAL_ID = "5f1c2d3e-aaaa-4bbb-8ccc-ddddeeeeffff";
const PROJECT_ID = "9a8b7c6d-1111-4222-8333-444455556666";
const ACCOUNT_ID = "0a1b2c3d-0000-4000-8000-000000000001";

function pending(): PendingQueue {
  return { accounts: [], credentials: [], projects: [], showcase: [] };
}

function decided(): DecidedQueue {
  return {
    accounts: [
      {
        id: ACCOUNT_ID,
        clerkId: "user_kofi",
        email: "kofi@example.com",
        role: "builder",
        builderId: "kofi-mensah",
        displayName: "Kofi Mensah",
        cohortId: "cohort-2026a",
        submittedAt: "2026-09-21T09:00:00+03:00",
        status: "confirmed",
        decidedAt: "2026-09-22T08:15:00+03:00",
        demoData: true,
      },
    ],
    credentials: [
      {
        id: CREDENTIAL_ID,
        builderId: "kofi-mensah",
        displayName: "Kofi Mensah",
        title: "Rust Advanced Concurrency",
        issuer: "MeTTa OmniUniversity",
        skillId: "rust",
        issuedOn: null,
        credentialUrl: null,
        submittedAt: "2026-09-21T10:00:00+03:00",
        status: "confirmed",
        decidedAt: "2026-09-23T11:30:00+03:00",
        demoData: true,
      },
    ],
    projects: [
      {
        id: PROJECT_ID,
        builderId: "kofi-mensah",
        displayName: "Kofi Mensah",
        title: "Clinic triage intake flow",
        vertical: "health",
        licensable: true,
        completedOn: "2026-08-12",
        skillIds: ["python", "rust"],
        submittedAt: "2026-09-20T12:00:00+03:00",
        status: "rejected",
        decidedAt: "2026-09-22T16:45:00+03:00",
        demoData: true,
      },
    ],
    showcase: [],
  };
}

function decision(kind: AdminDecisionKind, id: string, status: AdminDecision["status"], projectedRows: number): AdminDecision {
  return { id, kind, status, projectedRows };
}

describe("/admin Decided tab", () => {
  it("lists the decided rows with their status and decision date", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided: async () => decided() });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    const tab = await screen.findByRole("tab", { name: /Decided/ });
    expect(tab).toHaveTextContent("3");
    await user.click(tab);

    const row = await screen.findByRole("row", { name: /Rust Advanced Concurrency/ });
    expect(within(row).getByTestId("status-pill")).toHaveTextContent("Confirmed");
    expect(row).toHaveTextContent("23 Sep 2026");
    expect(within(row).getByText("Demo data")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Reverse" })).toBeInTheDocument();
    const project = screen.getByRole("row", { name: /Clinic triage intake flow/ });
    expect(within(project).getByTestId("status-pill")).toHaveTextContent("Rejected");
    expect(within(screen.getByRole("row", { name: /Kofi Mensah/ })).getByTestId("status-pill")).toHaveTextContent("Confirmed");
  });

  it("reverses a confirmed credential by rejecting it and shows the returned projected_rows", async () => {
    const user = userEvent.setup();
    const reject = vi.fn(async (kind: AdminDecisionKind, id: string) => decision(kind, id, "rejected", 44));
    const confirm = vi.fn();
    const getDecided = vi.fn(async () => decided());
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided, confirm, reject });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: /Decided/ }));
    const row = await screen.findByRole("row", { name: /Rust Advanced Concurrency/ });
    await user.click(within(row).getByRole("button", { name: "Reverse" }));

    await waitFor(() => expect(reject).toHaveBeenCalledWith("credential", CREDENTIAL_ID));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 44");
    await waitFor(() => expect(getDecided.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("reverses a rejected project by confirming it", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(async (kind: AdminDecisionKind, id: string) => decision(kind, id, "confirmed", 61));
    const reject = vi.fn();
    const marketplace = fakeMarketplace({ getPending: async () => pending(), getDecided: async () => decided(), confirm, reject });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: /Decided/ }));
    const row = await screen.findByRole("row", { name: /Clinic triage intake flow/ });
    await user.click(within(row).getByRole("button", { name: "Reverse" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("project", PROJECT_ID));
    expect(reject).not.toHaveBeenCalled();
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 61");
  });
});
