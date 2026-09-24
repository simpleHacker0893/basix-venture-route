/**
 * Seam: the route result with a routed store through React Testing Library (Sprint 004, #71;
 * D-19). A signed-in founder publishes the brief and the route snapshot the client holds; the
 * engine validates the brief again and never uses the snapshot for eligibility.
 */
import type { Request } from "@venture-route/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiValidationError, createApiSource } from "../src/api/client";
import { App } from "../src/App";
import { NO_KEY_AUTH, type AuthState } from "../src/auth/authContext";
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
const signedOut: AuthState = { ...NO_KEY_AUTH, configured: true };

function published(): Request {
  return {
    id: "r-1",
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
    eligibility: null,
    demoData: true,
  };
}

function renderRoute(auth: AuthState, postRequest: ReturnType<typeof vi.fn>) {
  const source = createApiSource("http://engine.test", engineFetch());
  const marketplace = fakeMarketplace({ postRequest: postRequest as never });
  render(<App initialPath="/route" source={source} auth={auth} marketplace={marketplace} />);
}

async function routeScenario(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Load scenario: ${label}` }));
  await user.click(await screen.findByRole("button", { name: "Find my route" }));
  await screen.findByRole("heading", { level: 1, name: "Your route through BASIX" });
  return user;
}

describe("Publish as request", () => {
  it("posts exactly the store's brief and the route snapshot, then navigates to the dashboard", async () => {
    const postRequest = vi.fn(async () => published());
    renderRoute(founderAuth, postRequest);
    const user = await routeScenario("Constrained brief");

    await user.click(screen.getByRole("button", { name: "Publish as request" }));

    await waitFor(() => expect(postRequest).toHaveBeenCalledTimes(1));
    const input = (postRequest.mock.calls as unknown[][])[0]?.[0] as { brief: unknown; route: unknown };
    expect(input.brief).toMatchObject({
      id: "brief-constrained-01",
      requiredSkills: ["mobile", "rust"],
      dailyBudget: 300,
      demoData: true,
    });
    expect(input.route).toEqual({ status: "partial", totalDailyRate: 130, builderIds: ["zawadi-njoroge"] });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 1, name: "Your route through BASIX" })).not.toBeInTheDocument(),
    );
  });

  it("renders a 422 inline on the result page and re-enables the button", async () => {
    const postRequest = vi.fn(async () => {
      throw new ApiValidationError({
        type: "validation-error",
        message: "brief.dailyBudget: Input should be greater than 0",
      });
    });
    renderRoute(founderAuth, postRequest);
    const user = await routeScenario("Constrained brief");

    await user.click(screen.getByRole("button", { name: "Publish as request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("dailyBudget: Input should be greater than 0");
    expect(screen.getByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish as request" })).toBeEnabled();
  });

  it("is disabled while posting", async () => {
    let resolve: (request: Request) => void = () => undefined;
    const postRequest = vi.fn(
      () =>
        new Promise<Request>((r) => {
          resolve = r;
        }),
    );
    renderRoute(founderAuth, postRequest);
    const user = await routeScenario("Constrained brief");

    await user.click(screen.getByRole("button", { name: "Publish as request" }));

    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();
    resolve(published());
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 1, name: "Your route through BASIX" })).not.toBeInTheDocument(),
    );
  });

  it.each([
    ["a builder", builderAuth],
    ["a signed-out visitor", signedOut],
  ])("renders no publish button for %s in this ticket", async (_label, auth) => {
    const postRequest = vi.fn(async () => published());
    renderRoute(auth, postRequest);
    await routeScenario("Constrained brief");

    expect(screen.queryByRole("button", { name: "Publish as request" })).not.toBeInTheDocument();
    expect(postRequest).not.toHaveBeenCalled();
  });
});
