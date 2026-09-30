/**
 * Offline demonstration source (D-34): the generated snapshot of the five seed briefs and the
 * routes MeTTa decided for them. Read only when VITE_OFFLINE_DEMO=1; never edited by the app.
 */
import { Ecosystem, VentureBrief, VentureRoute, type ChatResponse, type ChatTurnInput } from "@venture-route/contracts";
import { z } from "zod";

import snapshotJson from "../offline/snapshot.json";
import { ApiValidationError } from "./client";
import type { RouteSource } from "./source";

const Snapshot = z.object({
  briefs: z.record(z.string(), VentureBrief),
  routes: z.record(z.string(), VentureRoute),
  ecosystem: Ecosystem,
});

export const OFFLINE_BANNER = "Offline demonstration mode";

function canonical(brief: z.infer<typeof VentureBrief>): unknown {
  return Object.fromEntries(Object.entries(brief).sort(([a], [b]) => a.localeCompare(b)));
}

export function createOfflineSource(raw: unknown = snapshotJson): RouteSource {
  const snapshot = Snapshot.parse(raw);
  const briefs = Object.values(snapshot.briefs);

  const ONLY_SEEDS =
    "Offline demonstration mode only routes the five seed scenarios unchanged. Load one to continue.";

  /** The snapshot answers only a brief MeTTa actually saw: the seed brief, byte for byte. */
  function routeFor(brief: z.infer<typeof VentureBrief>) {
    const seed = snapshot.briefs[brief.id];
    const route = snapshot.routes[brief.id];
    if (!seed || !route || JSON.stringify(canonical(seed)) !== JSON.stringify(canonical(brief))) {
      throw new ApiValidationError({ type: "validation-error", message: ONLY_SEEDS });
    }
    return route;
  }

  return {
    kind: "offline",
    getScenarios: async () => briefs,
    getEcosystem: async () => snapshot.ecosystem,
    postRoute: async (brief) => routeFor(brief),
    postConversation: async (turn: ChatTurnInput): Promise<ChatResponse> => {
      const parsed = VentureBrief.safeParse({ ...(turn.currentBrief ?? {}), demoData: true });
      if (!parsed.success) return { type: "validation-error", message: ONLY_SEEDS };
      try {
        return { type: "route", brief: parsed.data, route: routeFor(parsed.data), message: OFFLINE_BANNER };
      } catch (error) {
        if (error instanceof ApiValidationError) return error.response;
        throw error;
      }
    },
  };
}
