import type { ChatResponse } from "@venture-route/contracts";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

import { ApiUnreachableError, ApiValidationError } from "../api/client";
import type { RouteSource } from "../api/source";
import { RoutingContext, type RoutingContextValue } from "./routingContext";
import { initialRoutingState, routingReducer } from "./routingReducer";

export function RoutingProvider({ source, children }: { source: RouteSource; children: ReactNode }) {
  const [state, dispatch] = useReducer(routingReducer, initialRoutingState);

  const run = useCallback(async (work: () => Promise<ChatResponse>) => {
    dispatch({ type: "request-started" });
    try {
      dispatch({ type: "response-received", response: await work() });
    } catch (error) {
      if (error instanceof ApiValidationError) {
        dispatch({ type: "response-received", response: error.response });
      } else {
        dispatch({ type: "engine-unreachable", message: describe(error) });
      }
    }
  }, []);

  const value = useMemo<RoutingContextValue>(
    () => ({
      state,
      source,
      loadScenarios: async () => {
        try {
          dispatch({ type: "scenarios-loaded", scenarios: await source.getScenarios() });
        } catch (error) {
          dispatch({ type: "engine-unreachable", message: describe(error) });
        }
      },
      loadScenario: (brief) => {
        dispatch({ type: "brief-changed", brief });
        dispatch({ type: "view-changed", view: "review" });
      },
      routeBrief: (brief) =>
        run(async () => ({
          type: "route",
          brief,
          route: await source.postRoute(brief),
          message: "",
        })),
      sendTurn: (turn) => {
        if (turn.userMessage) dispatch({ type: "founder-said", text: turn.userMessage });
        return run(() => source.postConversation(turn));
      },
      noteChloe: (text) => dispatch({ type: "chloe-said", text }),
      setBrief: (brief) => dispatch({ type: "brief-changed", brief }),
      showView: (view) => dispatch({ type: "view-changed", view }),
      hydrate: (brief, route) => dispatch({ type: "hydrated", brief, route }),
    }),
    [state, source, run],
  );

  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

function describe(error: unknown): string {
  if (error instanceof ApiUnreachableError) return error.message;
  return "The routing engine could not be reached.";
}
