import type { ChatTurnInput, PartialBriefInput, VentureBrief } from "@venture-route/contracts";
import { createContext, useContext } from "react";

import type { RouteSource } from "../api/source";
import type { RoutingState, View } from "./routingReducer";

export type RoutingContextValue = {
  state: RoutingState;
  source: RouteSource;
  loadScenarios(): Promise<void>;
  /** A scenario chip: the seed brief becomes the current brief and the review step opens. */
  loadScenario(brief: VentureBrief): void;
  /** Form path: a full brief to POST /api/route. */
  routeBrief(brief: VentureBrief): Promise<void>;
  /** Chat path: one founder turn to POST /api/conversation. */
  sendTurn(turn: ChatTurnInput): Promise<void>;
  setBrief(brief: PartialBriefInput | null): void;
  showView(view: View): void;
};

export const RoutingContext = createContext<RoutingContextValue | null>(null);

export function useRouting(): RoutingContextValue {
  const value = useContext(RoutingContext);
  if (!value) throw new Error("useRouting must be used inside RoutingProvider");
  return value;
}
