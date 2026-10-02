/**
 * Seam: the shared Stepper (components/Stepper.tsx). Every state is readable as text, not colour,
 * and only the current step carries aria-current.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "../src/components/Stepper";
import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";
import type { AuthState } from "../src/auth/authContext";

const signedOut: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: false,
  role: null,
  getToken: async () => null,
  reload: async () => undefined,
  signOut: async () => undefined,
};

describe("Stepper", () => {
  it("marks done, current and upcoming steps and only the current one as the current step", () => {
    render(
      <Stepper
        ariaLabel="Progress"
        steps={[
          { label: "Choose role", state: "done" },
          { label: "Sign in", state: "current" },
          { label: "Set up", state: "upcoming" },
        ]}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Progress" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Choose role");
    expect(items[0]).toHaveTextContent("done");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("current step");
    expect(items[2]).toHaveTextContent("upcoming");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("shows a review step with its pill and a locked step with its hint", () => {
    render(
      <Stepper
        ariaLabel="Account"
        layout="responsive"
        steps={[
          { label: "Confirmed by BASIX", hint: "An admin is reviewing your account now.", state: "review", pill: "In review" },
          { label: "Eligible for requests", hint: "Unlocks as soon as you are confirmed.", state: "locked" },
        ]}
      />,
    );

    const [review, locked] = within(screen.getByRole("list", { name: "Account" })).getAllByRole("listitem");
    expect(review).toHaveTextContent("In review");
    expect(review).toHaveTextContent("An admin is reviewing your account now.");
    expect(locked).toHaveTextContent("locked");
    expect(locked).toHaveTextContent("Unlocks as soon as you are confirmed.");
  });
});

describe("sign-in steps", () => {
  it("shows step 1 as current and the later steps as upcoming on the role screen", () => {
    render(<App initialPath="/sign-in" source={createOfflineSource()} auth={signedOut} />);

    for (const list of screen.getAllByRole("list", { name: "Sign-in progress" })) {
      const [first, second, third] = within(list).getAllByRole("listitem");
      expect(first).toHaveAttribute("aria-current", "step");
      expect(second).toHaveTextContent("upcoming");
      expect(third).toHaveTextContent("upcoming");
    }
  });
});
