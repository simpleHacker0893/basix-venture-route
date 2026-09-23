/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 003 #44).
 * Auth state is injected through `App`'s `auth` prop so Clerk never loads in jsdom; the
 * marketplace API is faked through the `marketplace` prop. No key is configured under Vitest.
 */
import type { RoleChoice, RoleResponse } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createRequest } from "../src/api/client";
import type { MarketplaceApi } from "../src/api/marketplace";
import { App } from "../src/App";
import type { AuthState, Role } from "../src/auth/authContext";
import { createOfflineSource } from "../src/api/offline";

const source = createOfflineSource();

function authState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    configured: true,
    isLoaded: true,
    isSignedIn: false,
    role: null,
    getToken: async () => null,
    reload: async () => undefined,
    signOut: async () => undefined,
    ...overrides,
  };
}

const signedIn = (role: Role | null) => authState({ isSignedIn: true, role });

function fakeMarketplace(postRole: MarketplaceApi["postRole"]): MarketplaceApi {
  return { postRole };
}

describe("no-key mode", () => {
  it("shows the not-configured panel on a marketplace route", () => {
    render(<App initialPath="/profile" source={source} />);

    const panel = screen.getByRole("region", { name: "Sign-in is not configured" });
    expect(within(panel).getByText(/VITE_CLERK_PUBLISHABLE_KEY/)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Route my venture" })).toHaveAttribute("href", "/route");
  });

  it("keeps the routing page working", () => {
    render(<App initialPath="/route" source={source} />);

    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("renders the sign-in frame with the panel inside", () => {
    render(<App initialPath="/sign-in" source={source} />);

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign-in is not configured" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Route without an account" })).toHaveAttribute("href", "/route");
  });
});

describe("RequireRole", () => {
  it("sends a signed-out visitor at /admin to the sign-in screen", () => {
    render(<App initialPath="/admin" source={source} auth={authState()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
  });

  it("sends a signed-in user without a role to the role cards", () => {
    render(<App initialPath="/profile" source={source} auth={signedIn(null)} />);

    expect(screen.getByRole("button", { name: /I am a founder/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I am a builder/ })).toBeInTheDocument();
  });

  it("sends a builder away from /admin to their profile", () => {
    render(<App initialPath="/admin" source={source} auth={signedIn("builder")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
  });

  it("lets an admin see the confirmation queue", () => {
    render(<App initialPath="/admin" source={source} auth={signedIn("admin")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Confirmation queue" })).toBeInTheDocument();
  });

  it("sends a founder away from /profile to the routing page", () => {
    render(<App initialPath="/profile" source={source} auth={signedIn("founder")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });
});

describe("RoleSelect", () => {
  it("posts the chosen role, reloads the user and lands on the role home", async () => {
    const user = userEvent.setup();
    const posted: RoleChoice[] = [];
    const state = signedIn(null);
    const reload = vi.fn(async () => {
      state.role = "builder";
    });
    state.reload = reload;
    const marketplace = fakeMarketplace(async (choice) => {
      posted.push(choice);
      const response: RoleResponse = { clerkId: "user_1", role: choice.role, confirmed: false };
      return response;
    });

    render(<App initialPath="/choose-role" source={source} auth={state} marketplace={marketplace} />);
    await user.click(screen.getByRole("button", { name: /I am a builder/ }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument());
    expect(posted).toEqual([{ role: "builder" }]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows an inline message when the role was already chosen (409)", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace(async () => {
      throw new Error("The routing engine answered 409.");
    });

    render(<App initialPath="/choose-role" source={source} auth={signedIn(null)} marketplace={marketplace} />);
    await user.click(screen.getByRole("button", { name: /I am a founder/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/409/);
    expect(screen.getByRole("button", { name: /I am a founder/ })).toBeInTheDocument();
  });

  it("redirects a user who already has a role to that role's home", () => {
    render(<App initialPath="/choose-role" source={source} auth={signedIn("admin")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Confirmation queue" })).toBeInTheDocument();
  });
});

describe("bearer token", () => {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchLike: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), auth: headers.get("authorization") });
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  };

  it("attaches the bearer header only on guarded prefixes", async () => {
    const { z } = await import("zod");
    const request = createRequest("http://engine.test", fetchLike, async () => "tok-1");
    for (const path of ["/api/me/profile", "/api/admin/pending", "/api/builders/amina-otieno", "/api/route", "/api/scenarios", "/health"]) {
      await request(path, z.object({}));
    }

    expect(calls.map((c) => [c.url.replace("http://engine.test", ""), c.auth])).toEqual([
      ["/api/me/profile", "Bearer tok-1"],
      ["/api/admin/pending", "Bearer tok-1"],
      ["/api/builders/amina-otieno", "Bearer tok-1"],
      ["/api/route", null],
      ["/api/scenarios", null],
      ["/health", null],
    ]);
  });
});
