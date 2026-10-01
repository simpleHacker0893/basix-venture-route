/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 003 #44).
 * Auth state is injected through `App`'s `auth` prop so Clerk never loads in jsdom; the
 * marketplace API is faked through the `marketplace` prop. No key is configured under Vitest.
 */
import type { RoleChoice, RoleResponse } from "@venture-route/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiStatusError, createRequest } from "../src/api/client";
import type { MarketplaceApi } from "../src/api/marketplace";
import { App } from "../src/App";
import type { AuthState, Role } from "../src/auth/authContext";
import { createOfflineSource } from "../src/api/offline";
import { ROLE_INTENT_KEY } from "../src/lib/roleIntent";
import { fakeMarketplace as fakeApi } from "./fakeMarketplace";

const source = createOfflineSource();

beforeEach(() => {
  window.sessionStorage.clear();
});

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
  return fakeApi({ postRole });
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

  it("renders the role step, then the sign-in frame with the panel inside", async () => {
    const user = userEvent.setup();
    render(<App initialPath="/sign-in" source={source} />);

    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Route without an account" })).toHaveAttribute("href", "/route");
    await user.click(screen.getByRole("button", { name: "Continue as founder" }));

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign-in is not configured" })).toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("sends a signed-out visitor at /admin to the sign-in screen", () => {
    render(<App initialPath="/admin" source={source} auth={authState()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
  });

  it("sends a signed-in user without a role to the role cards", () => {
    render(<App initialPath="/profile" source={source} auth={signedIn(null)} />);

    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I’m a founder/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I’m a builder/ })).toBeInTheDocument();
    // Requests, bids and interviews shipped in Sprint 004, so the cards may name them (rule 10).
    expect(screen.getByText("Publish requests, book interviews")).toBeInTheDocument();
    expect(screen.getByText("Bid on requests, take interviews")).toBeInTheDocument();
    expect(screen.getByText(/role is set once/i)).toBeInTheDocument();
  });

  it("sends a builder away from /admin to their home", () => {
    render(<App initialPath="/admin" source={source} auth={signedIn("builder")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it("lets an admin see the confirmation queue", () => {
    render(<App initialPath="/admin" source={source} auth={signedIn("admin")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Review queue" })).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /I’m a builder/ }));
    expect(screen.getByRole("button", { name: /I’m a builder/ })).toHaveAttribute("aria-pressed", "true");
    expect(posted).toEqual([]); // selecting a card saves nothing until Continue
    await user.click(screen.getByRole("button", { name: "Continue as builder" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument());
    expect(posted).toEqual([{ role: "builder" }]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows an inline message when the role was already chosen (409)", async () => {
    const user = userEvent.setup();
    const marketplace = fakeMarketplace(async () => {
      throw new Error("The routing engine answered 409.");
    });

    render(<App initialPath="/choose-role" source={source} auth={signedIn(null)} marketplace={marketplace} />);
    await user.click(screen.getByRole("button", { name: /I’m a founder/ }));
    await user.click(screen.getByRole("button", { name: "Continue as founder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/409/);
    expect(screen.getByRole("button", { name: /I’m a founder/ })).toBeInTheDocument();
  });

  it("redirects a user who already has a role to that role's home", () => {
    render(<App initialPath="/choose-role" source={source} auth={signedIn("admin")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Review queue" })).toBeInTheDocument();
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

describe("role first (D-54)", () => {
  it("asks who you are before sign-in, remembers the pick and shows it on the sign-up step", async () => {
    const user = userEvent.setup();
    render(<App initialPath="/sign-up" source={source} auth={authState()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /I’m a builder/ }));
    await user.click(screen.getByRole("button", { name: "Continue as builder" }));

    expect(screen.getByRole("heading", { level: 1, name: "Create your builder account" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(ROLE_INTENT_KEY)).toBe("builder");
    await user.click(screen.getByRole("button", { name: "Builder: change role" }));
    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(ROLE_INTENT_KEY)).toBeNull();
  });

  it("goes back from sign-in to the role step with the pick kept, and from the role step to the landing page", async () => {
    const user = userEvent.setup();
    render(<App initialPath="/sign-in" source={source} auth={authState()} />);

    await user.click(screen.getByRole("button", { name: /I’m a builder/ }));
    await user.click(screen.getByRole("button", { name: "Continue as builder" }));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I’m a builder/ })).toHaveAttribute("aria-pressed", "true");
    expect(window.sessionStorage.getItem(ROLE_INTENT_KEY)).toBeNull();

    // Opened directly (no history in this tab), Back on the role step goes to the landing page.
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "A founding team you can verify." })).toBeInTheDocument();
  });

  it("shows only Loading… and no role cards while Clerk has not loaded", () => {
    render(<App initialPath="/sign-in" source={source} auth={authState({ isLoaded: false })} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Who are you?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /I’m a founder/ })).not.toBeInTheDocument();
  });

  it("lets a BASIX admin skip the role cards", async () => {
    const user = userEvent.setup();
    render(<App initialPath="/sign-in" source={source} auth={authState()} />);

    await user.click(screen.getByRole("button", { name: "BASIX admin? Sign in" }));

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin: change role" })).toBeInTheDocument();
  });

  it("saves the picked role once after sign-in and lands on that role's home", async () => {
    window.sessionStorage.setItem(ROLE_INTENT_KEY, "builder");
    const posted: RoleChoice[] = [];
    const state = signedIn(null);
    state.reload = vi.fn(async () => {
      state.role = "builder";
    });
    const marketplace = fakeMarketplace(async (choice) => {
      posted.push(choice);
      return { clerkId: "user_1", role: choice.role, confirmed: false };
    });

    render(<App initialPath="/choose-role" source={source} auth={state} marketplace={marketplace} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(posted).toEqual([{ role: "builder" }]);
    expect(window.sessionStorage.getItem(ROLE_INTENT_KEY)).toBeNull();
  });

  it("stays on /choose-role with an error and Try again when saving the picked role fails", async () => {
    const user = userEvent.setup();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.sessionStorage.setItem(ROLE_INTENT_KEY, "builder");
    const state = signedIn(null);
    state.reload = vi.fn(async () => {
      state.role = "builder";
    });
    let attempts = 0;
    const marketplace = fakeMarketplace(async (choice) => {
      attempts += 1;
      if (attempts === 1) throw new ApiStatusError(500, "The routing engine answered 500.");
      return { clerkId: "user_1", role: choice.role, confirmed: false };
    });

    render(<App initialPath="/choose-role" source={source} auth={state} marketplace={marketplace} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your role. Please try again.");
    expect(screen.getByRole("heading", { level: 1, name: "Setting up your builder account…" })).toBeInTheDocument();
    expect(state.reload).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("status 500"), expect.anything());

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(attempts).toBe(2);
    errorLog.mockRestore();
  });

  it("treats a 409 as saved and moves on", async () => {
    window.sessionStorage.setItem(ROLE_INTENT_KEY, "builder");
    const state = signedIn(null);
    state.reload = vi.fn(async () => {
      state.role = "builder";
    });
    const marketplace = fakeMarketplace(async () => {
      throw new ApiStatusError(409, "The routing engine answered 409.");
    });

    render(<App initialPath="/choose-role" source={source} auth={state} marketplace={marketplace} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it("shows the error and does not navigate when the bridge's save fails away from /choose-role", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.sessionStorage.setItem(ROLE_INTENT_KEY, "builder");
    const state = signedIn(null);
    const marketplace = fakeMarketplace(async () => {
      throw new ApiStatusError(503, "The routing engine answered 503.");
    });

    render(<App initialPath="/route" source={source} auth={state} marketplace={marketplace} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your role. Please try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
    errorLog.mockRestore();
  });

  it("shows the error on the manual Who are you? screen and keeps it there", async () => {
    const user = userEvent.setup();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const marketplace = fakeMarketplace(async () => {
      throw new ApiStatusError(500, "The routing engine answered 500.");
    });

    render(<App initialPath="/choose-role" source={source} auth={signedIn(null)} marketplace={marketplace} />);

    await user.click(await screen.findByRole("button", { name: "Continue as founder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your role. Please try again.");
    expect(screen.getByRole("heading", { level: 1, name: "Who are you?" })).toBeInTheDocument();
    errorLog.mockRestore();
  });

  it("keeps an existing account's role and says so when the other card was picked", async () => {
    window.sessionStorage.setItem(ROLE_INTENT_KEY, "builder");
    const postRole = vi.fn();
    render(<App initialPath="/choose-role" source={source} auth={signedIn("founder")} marketplace={fakeMarketplace(postRole)} />);

    expect(await screen.findByRole("status", { name: "Role note" })).toHaveTextContent(
      "You picked builder, but this account is already a founder account. A role is set once, so you're signed in as a founder.",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
    expect(postRole).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(ROLE_INTENT_KEY)).toBeNull();
  });
});
