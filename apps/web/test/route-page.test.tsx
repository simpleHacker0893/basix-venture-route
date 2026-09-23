/**
 * Seam: rendered /route screen through React Testing Library (Sprint 002 #24).
 * `fetch` is the system boundary and the only thing faked; the real client parses every
 * response with the contract schemas.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createApiSource } from "../src/api/client";
import { App } from "../src/App";
import snapshot from "../src/offline/snapshot.json";

type FetchLike = typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Answers like the Sprint 001 engine, from the generated snapshot. */
function engineFetch(overrides: Partial<Record<"scenarios" | "route", () => Response>> = {}): FetchLike {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/scenarios")) {
      return overrides.scenarios?.() ?? jsonResponse(Object.values(snapshot.briefs));
    }
    if (url.endsWith("/api/route")) {
      if (overrides.route) return overrides.route();
      const brief = JSON.parse(String(init?.body)) as { id: keyof typeof snapshot.routes };
      return jsonResponse(snapshot.routes[brief.id]);
    }
    throw new Error(`unexpected url ${url}`);
  };
}

function renderRoutePage(fetchLike: FetchLike) {
  const source = createApiSource("http://engine.test", fetchLike);
  return render(<App initialPath="/route" source={source} />);
}

describe("/route: scenario chips to a route", () => {
  it("lists the five seed scenarios and routes the Health pilot on click", async () => {
    renderRoutePage(engineFetch());
    const user = userEvent.setup();

    const chip = await screen.findByRole("button", { name: /Health pilot/ });
    expect(screen.getAllByRole("button", { name: /^Load scenario:/ })).toHaveLength(5);

    await user.click(chip);

    expect(await screen.findByText("feasible")).toBeInTheDocument();
    expect(screen.getByText("USD 370 / day")).toBeInTheDocument();
    expect(screen.queryByText(/Use the form instead/)).not.toBeInTheDocument();
  });

  it("shows the API-unreachable banner when the engine cannot be reached, never a blank screen", async () => {
    renderRoutePage(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Use the form instead");
    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });

  it("shows the banner when a response does not match the contract", async () => {
    renderRoutePage(engineFetch({ scenarios: () => jsonResponse([{ id: "brief-x" }]) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use the form instead");
  });

  it("keeps a validation-error answer as a message, not a crash", async () => {
    renderRoutePage(
      engineFetch({
        route: () =>
          jsonResponse({ type: "validation-error", message: "dailyBudget: Input should be greater than 0" }, 422),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Health pilot/ }));

    expect(await screen.findByText(/dailyBudget: Input should be greater than 0/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
