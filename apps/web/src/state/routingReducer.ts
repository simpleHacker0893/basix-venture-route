/**
 * Routing state: one store for the founder flow (requirements.md In scope 3).
 * Holds the scenarios, the current partial brief, the chat turns and the latest ChatResponse.
 * A pure reducer; the provider in RoutingProvider.tsx drives it (useReducer + context, no extra
 * state library, per the blueprint).
 */
import type { ChatResponse, PartialBriefInput, VentureBrief } from "@venture-route/contracts";

export type Turn = { role: "founder" | "assistant"; text: string };

export type RoutingState = {
  scenarios: VentureBrief[];
  currentBrief: PartialBriefInput | null;
  turns: Turn[];
  lastResponse: ChatResponse | null;
  busy: boolean;
  /** Set when the engine is unreachable or answers outside the contract; cleared on success. */
  unreachable: string | null;
};

export type RoutingAction =
  | { type: "scenarios-loaded"; scenarios: VentureBrief[] }
  | { type: "brief-changed"; brief: PartialBriefInput | null }
  | { type: "founder-said"; text: string }
  | { type: "request-started" }
  | { type: "response-received"; response: ChatResponse }
  | { type: "engine-unreachable"; message: string };

export const initialRoutingState: RoutingState = {
  scenarios: [],
  currentBrief: null,
  turns: [],
  lastResponse: null,
  busy: false,
  unreachable: null,
};

export function routingReducer(state: RoutingState, action: RoutingAction): RoutingState {
  switch (action.type) {
    case "scenarios-loaded":
      return { ...state, scenarios: action.scenarios, unreachable: null };
    case "brief-changed":
      return { ...state, currentBrief: action.brief };
    case "founder-said":
      return { ...state, turns: [...state.turns, { role: "founder", text: action.text }] };
    case "request-started":
      return { ...state, busy: true };
    case "response-received": {
      const turns =
        action.response.type === "validation-error"
          ? state.turns
          : [...state.turns, { role: "assistant" as const, text: action.response.message }];
      const currentBrief =
        action.response.type === "clarification"
          ? action.response.partialBrief
          : action.response.type === "route"
            ? action.response.brief
            : state.currentBrief;
      return {
        ...state,
        busy: false,
        unreachable: null,
        turns,
        currentBrief,
        lastResponse: action.response,
      };
    }
    case "engine-unreachable":
      return { ...state, busy: false, unreachable: action.message };
  }
}
