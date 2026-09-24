/**
 * Seam: the route flow through React Testing Library with session storage (Sprint 004, #72;
 * D-19). A visitor who routed a brief before signing in does not lose it: "Sign in to publish"
 * stashes the brief and the route snapshot under one key and opens sign-in with a redirect back
 * to the route flow, which restores the stash on mount through the hydrate action and clears it.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiSource } from "../src/api/client";
import { App } from "../src/App";
import { NO_KEY_AUTH, type AuthState } from "../src/auth/authContext";
import { STASH_KEY } from "../src/lib/publishStash";
import { engineFetch, SEED_BRIEFS } from "./fakeEngine";
import { fakeMarketplace } from "./fakeMarketplace";

const signedOut: AuthState = { ...NO_KEY_AUTH, configured: true };
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
const stashedRoute = {
  status: "partial" as const,
  builders: [],
  totalDailyRate: 0,
  reusableIp: null,
  cohort: null,
  partner: null,
  gaps: [
    {
      category: "skill" as const,
      statement: "No verified builder for mobile in the graph.",
      affected: ["mobile"],
      nextActions: ["Ask BASIX to confirm a credential or project for mobile."],
      rule: "route-gap" as const,
    },
  ],
  rulesApplied: ["route-gap"],
  summary: "Stashed route summary.",
};

function renderRoute(auth: AuthState) {
  const source = createApiSource("http://engine.test", engineFetch());
  render(<App initialPath="/route" source={source} auth={auth} marketplace={fakeMarketplace()} />);
}

async function routeScenario(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Load scenario: ${label}` }));
  await user.click(await screen.findByRole("button", { name: "Find my route" }));
  await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" });
  return user;
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Sign in to publish", () => {
  it("stashes the brief and the route snapshot, then opens sign-in with a redirect back", async () => {
    renderRoute(signedOut);
    const user = await routeScenario("Constrained brief");

    await user.click(screen.getByRole("button", { name: "Sign in to publish" }));

    const raw = window.sessionStorage.getItem(STASH_KEY);
    expect(raw).not.toBeNull();
    const stash = JSON.parse(raw!) as { brief: { id: string }; route: { status: string } };
    expect(stash.brief.id).toBe("brief-constrained-01");
    expect(stash.route.status).toBe("partial");
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
  });

  it("restores a stash on mount, clears it and shows Publish as request to the signed-in founder", async () => {
    window.sessionStorage.setItem(STASH_KEY, JSON.stringify({ brief: constrained, route: stashedRoute }));

    renderRoute(founderAuth);

    expect(await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeInTheDocument();
    expect(screen.getByText("Stashed route summary.")).toBeInTheDocument();
    expect(screen.getByTestId("status-badge")).toHaveTextContent(/^Partial$/);
    expect(screen.getByRole("button", { name: "Publish as request" })).toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem(STASH_KEY)).toBeNull());
  });

  it("degrades to a plain sign-in link when session storage throws, writing nothing", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderRoute(signedOut);
    await routeScenario("Constrained brief");

    const link = screen.getByRole("link", { name: "Sign in to publish" });
    expect(link).toHaveAttribute("href", "/sign-in?redirect_url=%2Froute");
    expect(screen.queryByRole("button", { name: "Sign in to publish" })).not.toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("ignores and clears a corrupt stash", async () => {
    window.sessionStorage.setItem(STASH_KEY, '{"brief": {"id": 1}, "route": "no"}');

    renderRoute(founderAuth);

    expect(await screen.findByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Your route through BASIX" })).not.toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem(STASH_KEY)).toBeNull());
  });

  it("shows a signed-in builder neither publish control", async () => {
    renderRoute(builderAuth);
    await routeScenario("Constrained brief");

    expect(screen.queryByRole("button", { name: "Publish as request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in to publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to publish" })).not.toBeInTheDocument();
  });
});
