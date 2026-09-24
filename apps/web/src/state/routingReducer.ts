/**
 * Routing state: one store for the founder flow (requirements.md In scope 3).
 * Holds the scenarios, the current partial brief, the chat turns, the latest ChatResponse and
 * which step of the flow is on screen. A pure reducer; RoutingProvider.tsx drives it.
 */
import type { ChatResponse, PartialBriefInput, VentureBrief, VentureRoute } from "@venture-route/contracts";

export type Turn = { role: "founder" | "assistant"; text: string };

/** The founder flow lives on /route: intake → review → result (blueprint router). */
export type View = "intake" | "review" | "result";

export type RoutingState = {
  scenarios: VentureBrief[];
  currentBrief: PartialBriefInput | null;
  turns: Turn[];
  lastResponse: ChatResponse | null;
  view: View;
  busy: boolean;
  /** Set when the engine is unreachable or answers outside the contract; cleared on success. */
  unreachable: string | null;
};

export type RoutingAction =
  | { type: "scenarios-loaded"; scenarios: VentureBrief[] }
  | { type: "brief-changed"; brief: PartialBriefInput | null }
  | { type: "view-changed"; view: View }
  | { type: "founder-said"; text: string }
  | { type: "request-started" }
  | { type: "response-received"; response: ChatResponse }
  | { type: "engine-unreachable"; message: string }
  /**
   * An already-confirmed brief and its route enter the store exactly as if the founder had
   * just routed (Sprint 004, #68): the dashboard's "View route" and the sign-in restore of a
   * stashed publish.
   */
  | { type: "hydrated"; brief: VentureBrief; route: VentureRoute };

export const initialRoutingState: RoutingState = {
  scenarios: [],
  currentBrief: null,
  turns: [],
  lastResponse: null,
  view: "intake",
  busy: false,
  unreachable: null,
};

export function routingReducer(state: RoutingState, action: RoutingAction): RoutingState {
  switch (action.type) {
    case "scenarios-loaded":
      return { ...state, scenarios: action.scenarios, unreachable: null };
    case "brief-changed":
      return { ...state, currentBrief: action.brief, lastResponse: dropStaleError(state.lastResponse) };
    case "view-changed":
      return { ...state, view: action.view, lastResponse: dropStaleError(state.lastResponse) };
    case "founder-said":
      return { ...state, turns: [...state.turns, { role: "founder", text: action.text }] };
    case "request-started":
      return { ...state, busy: true };
    case "response-received": {
      const { response } = action;
      const turns =
        response.type === "validation-error" || !response.message
          ? state.turns
          : [...state.turns, { role: "assistant" as const, text: response.message }];
      const currentBrief =
        response.type === "clarification"
          ? response.partialBrief
          : response.type === "route"
            ? response.brief
            : state.currentBrief;
      const view: View =
        response.type === "route" ? "result" : response.type === "clarification" ? "intake" : state.view;
      return {
        ...state,
        busy: false,
        unreachable: null,
        turns,
        currentBrief,
        view,
        lastResponse: response,
      };
    }
    case "engine-unreachable":
      return { ...state, busy: false, unreachable: action.message };
    case "hydrated":
      return routingReducer(state, {
        type: "response-received",
        response: { type: "route", brief: action.brief, route: action.route, message: "" },
      });
  }
}

/** A validation-error belongs to the brief that was submitted; a new brief or step starts clean. */
function dropStaleError(response: ChatResponse | null): ChatResponse | null {
  return response?.type === "validation-error" ? null : response;
}
