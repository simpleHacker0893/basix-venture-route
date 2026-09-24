/**
 * Seam: rendered screens through React Testing Library (D-19, Sprint 005a #96). The header link
 * and the public Showcase routes must render the same way signed out and signed in; #104/#105
 * replace the placeholder bodies these routes render for now.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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

function renderShell(auth: AuthState | undefined, path = "/") {
  const marketplace = fakeMarketplace();
  render(<App initialPath={path} source={source} auth={auth} marketplace={marketplace} />);
  return { user: userEvent.setup() };
}

describe("Showcase header link (spec #86 story 30)", () => {
  it("appears in the desktop primary nav, signed out", () => {
    renderShell(undefined);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Showcase" })).toHaveAttribute("href", "/showcase");
  });

  it("appears in the mobile menu once opened, signed out", async () => {
    const { user } = renderShell(undefined);

    await user.click(screen.getByRole("button", { name: "Menu" }));

    const mobileNav = screen.getByRole("navigation", { name: "Mobile" });
    expect(within(mobileNav).getByRole("link", { name: "Showcase" })).toHaveAttribute("href", "/showcase");
  });

  it("appears in both the desktop nav and the mobile menu, signed in", async () => {
    const { user } = renderShell(builderAuth);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Showcase" })).toHaveAttribute("href", "/showcase");

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Mobile" });
    expect(within(mobileNav).getByRole("link", { name: "Showcase" })).toHaveAttribute("href", "/showcase");
  });
});

describe("public Showcase routes (spec #86 stories 30-31, 39)", () => {
  it("renders /showcase without sign-in", () => {
    renderShell(undefined, "/showcase");

    expect(screen.getByRole("heading", { name: "Showcase" })).toBeInTheDocument();
  });

  it("renders /showcase/:projectId without sign-in", async () => {
    renderShell(undefined, "/showcase/venture-route");

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
