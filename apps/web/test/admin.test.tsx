/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 003 #46).
 * `/admin` is driven through the full App with an injected admin auth state and a fake
 * marketplace API. The engine reprojects the graph and reports `projectedRows`; the screen only
 * posts the decision and renders what came back.
 */
import type { AdminDecision, DecidedQueue, DecisionKind, PendingQueue } from "@venture-route/contracts";
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

const founderAuth: AuthState = { ...adminAuth, role: "founder", getToken: async () => "tok-founder" };

const CREDENTIAL_ID = "5f1c2d3e-aaaa-4bbb-8ccc-ddddeeeeffff";
const PROJECT_ID = "9a8b7c6d-1111-4222-8333-444455556666";

function queue(): PendingQueue {
  return {
    accounts: [
      {
        id: "0a1b2c3d-0000-4000-8000-000000000001",
        clerkId: "user_kofi",
        email: "kofi@example.com",
        role: "builder",
        builderId: "kofi-mensah",
        displayName: "Kofi Mensah",
        cohortId: "cohort-2026a",
        submittedAt: "2026-09-21T09:00:00+03:00",
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
        submittedAt: "2026-09-21T10:00:00+03:00",
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
        demoData: true,
      },
    ],
  };
}

function decided(): DecidedQueue {
  return { accounts: [], credentials: [], projects: [] };
}

function decision(kind: DecisionKind, id: string, status: AdminDecision["status"], projectedRows: number): AdminDecision {
  return { id, kind, status, projectedRows };
}

describe("/admin", () => {
  it("shows the three tabs with counts, confirms the credential and reports projected_rows", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(async (kind: DecisionKind, id: string) => decision(kind, id, "confirmed", 57));
    const marketplace = fakeMarketplace({ getPending: async () => queue(), getDecided: async () => decided(), confirm });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Confirmation queue" })).toBeInTheDocument();
    const accounts = await screen.findByRole("tab", { name: /Accounts/ });
    expect(accounts).toHaveTextContent("1");
    const credentials = screen.getByRole("tab", { name: /Credentials/ });
    expect(credentials).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Projects/ })).toHaveTextContent("1");

    await user.click(credentials);
    const row = await screen.findByRole("row", { name: /Rust Advanced Concurrency/ });
    expect(within(row).getByText("Demo data")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("credential", CREDENTIAL_ID));
    await waitFor(() => expect(screen.queryByRole("row", { name: /Rust Advanced Concurrency/ })).not.toBeInTheDocument());
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 57");
    expect(screen.getByRole("tab", { name: /Credentials/ })).toHaveTextContent("0");
  });

  it("rejects the project with its kind and id", async () => {
    const user = userEvent.setup();
    const reject = vi.fn(async (kind: DecisionKind, id: string) => decision(kind, id, "rejected", 51));
    const marketplace = fakeMarketplace({ getPending: async () => queue(), getDecided: async () => decided(), reject });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: /Projects/ }));
    const row = await screen.findByRole("row", { name: /Clinic triage intake flow/ });
    await user.click(within(row).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(reject).toHaveBeenCalledWith("project", PROJECT_ID));
    await waitFor(() => expect(screen.queryByRole("row", { name: /Clinic triage intake flow/ })).not.toBeInTheDocument());
    expect(await screen.findByRole("status", { name: "Last decision" })).toHaveTextContent("projected_rows: 51");
  });

  it("shows the projection preview for an expanded credential row", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace({ getPending: async () => queue(), getDecided: async () => decided() });

    render(<App initialPath="/admin" source={source} auth={adminAuth} marketplace={marketplace} />);

    await user.click(await screen.findByRole("tab", { name: /Credentials/ }));
    const row = await screen.findByRole("row", { name: /Rust Advanced Concurrency/ });
    await user.click(within(row).getByRole("button", { name: "Expand row" }));

    const preview = await screen.findByRole("region", { name: "Projection preview" });
    expect(preview).toHaveTextContent("(earned kofi-mensah cred-5f1c2d3e)");
    expect(preview).toHaveTextContent("(proves cred-5f1c2d3e rust)");
    expect(preview).toHaveTextContent("(confirmed admin-basix cred-5f1c2d3e)");
  });

  it("sends a founder away from /admin to the routing page", async () => {
    render(<App initialPath="/admin" source={source} auth={founderAuth} marketplace={fakeMarketplace()} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });
});
