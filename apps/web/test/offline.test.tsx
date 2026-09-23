/**
 * Seam: rendered screens with the offline source (VITE_OFFLINE_DEMO=1) through React Testing
 * Library (Sprint 002 #30, D-34). No fetch exists at all: the snapshot is the only source.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createOfflineSource } from "../src/api/offline";
import { App } from "../src/App";

function renderOffline(path = "/route") {
  vi.stubGlobal("fetch", () => {
    throw new Error("network must not be used in offline demonstration mode");
  });
  return render(<App initialPath={path} source={createOfflineSource()} />);
}

describe("offline demonstration mode", () => {
  it("shows the offline banner and routes every scenario from the snapshot with no network", async () => {
    renderOffline();
    const user = userEvent.setup();

    expect(await screen.findByRole("status", { name: "Offline demonstration mode" })).toBeInTheDocument();
    const expected: Record<string, string> = {
      "Health pilot": "Feasible",
      "Agri marketplace": "Feasible",
      "Constrained brief": "Partial",
      "Budget challenge": "Partial",
      "Delivery-mode challenge": "Infeasible",
    };
    for (const [label, status] of Object.entries(expected)) {
      await user.click(await screen.findByRole("button", { name: `Load scenario: ${label}` }));
      await user.click(await screen.findByRole("button", { name: "Find my route" }));
      expect(await screen.findByTestId("status-badge")).toHaveTextContent(status);
      await user.click(screen.getByRole("button", { name: "Change brief" }));
      await user.click(await screen.findByRole("button", { name: "Back to chat" }));
    }
  }, 30000);

  it("answers a confirmed brief on the chat path from the snapshot too", async () => {
    renderOffline();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Load scenario: Constrained brief" }));
    await user.click(await screen.findByRole("button", { name: "Find my route" }));

    const gaps = await screen.findByTestId("gaps-panel");
    expect(within(gaps).getAllByTestId("gap")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Offline demonstration mode" })).toBeInTheDocument();
  });
});
