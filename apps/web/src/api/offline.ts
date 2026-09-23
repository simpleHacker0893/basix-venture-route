/**
 * Offline demonstration source (D-34): the generated snapshot of the five seed briefs and the
 * routes MeTTa decided for them. Read only when VITE_OFFLINE_DEMO=1; never edited by the app.
 */
import { VentureBrief, VentureRoute, type ChatResponse, type ChatTurnInput } from "@venture-route/contracts";
import { z } from "zod";

import snapshotJson from "../offline/snapshot.json";
import type { RouteSource } from "./source";

const Snapshot = z.object({
  briefs: z.record(z.string(), VentureBrief),
  routes: z.record(z.string(), VentureRoute),
});

export const OFFLINE_BANNER = "Offline demonstration mode";

export function createOfflineSource(raw: unknown = snapshotJson): RouteSource {
  const snapshot = Snapshot.parse(raw);
  const briefs = Object.values(snapshot.briefs);

  function routeFor(brief: z.infer<typeof VentureBrief>) {
    const route = snapshot.routes[brief.id];
    if (!route) {
      throw new Error(`Offline mode has no route for ${brief.id}; load one of the five scenarios.`);
    }
    return route;
  }

  return {
    kind: "offline",
    getScenarios: async () => briefs,
    postRoute: async (brief) => routeFor(brief),
    postConversation: async (turn: ChatTurnInput): Promise<ChatResponse> => {
      const parsed = VentureBrief.safeParse({ ...(turn.currentBrief ?? {}), demoData: true });
      if (!parsed.success) {
        return {
          type: "validation-error",
          message: "Offline demonstration mode only routes the five seed scenarios. Load one to continue.",
        };
      }
      return { type: "route", brief: parsed.data, route: routeFor(parsed.data), message: OFFLINE_BANNER };
    },
  };
}
