/**
 * Seam: RTL for ChatThread's chloe branch (Sprint 006 In scope 3). Renders the real
 * RoutingProvider and drives a chloe turn through `noteChloe`, exactly the path
 * `useChloe` will use, rather than editing test/fakeEngine.tsx (owned by #91 this wave).
 */
import type { ChatResponse, Ecosystem, VentureBrief, VentureRoute } from "@venture-route/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatThread } from "../src/features/intake/ChatThread";
import { RoutingProvider } from "../src/state/RoutingProvider";
import { useRouting } from "../src/state/routingContext";

const source = {
  kind: "api" as const,
  getScenarios: async (): Promise<VentureBrief[]> => [],
  postRoute: async (): Promise<VentureRoute> => {
    throw new Error("not used in this seam");
  },
  postConversation: async (): Promise<ChatResponse> => {
    throw new Error("not used in this seam");
  },
  getEcosystem: async (): Promise<Ecosystem> => ({ partners: [], universities: [], assets: [], demoData: true }),
};

/** Renders the chat thread bound to the real store, plus a button that calls noteChloe. */
function Harness() {
  const { state, noteChloe } = useRouting();
  return (
    <div>
      <button onClick={() => noteChloe("What is the working title?")}>say</button>
      <ChatThread turns={state.turns} />
    </div>
  );
}

function renderHarness() {
  return render(
    <RoutingProvider source={source}>
      <Harness />
    </RoutingProvider>,
  );
}

describe("ChatThread: chloe turn", () => {
  it("renders a chloe turn labelled Chloe, appended via noteChloe", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "say" }));

    const chloeTurn = await screen.findByTestId("chloe-turn");
    expect(chloeTurn).toHaveTextContent("Chloe");
    expect(chloeTurn).toHaveTextContent("What is the working title?");
  });
});
