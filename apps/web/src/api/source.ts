/**
 * RouteSource: where briefs and routes come from. The live engine (api/client.ts) and the
 * generated offline snapshot (api/offline.ts) implement the same interface, so screens never
 * know which one they talk to.
 */
import type { ChatResponse, ChatTurnInput, Ecosystem, VentureBrief, VentureRoute } from "@venture-route/contracts";

export type RouteSource = {
  kind: "api" | "offline";
  getScenarios(): Promise<VentureBrief[]>;
  postRoute(brief: VentureBrief): Promise<VentureRoute>;
  postConversation(turn: ChatTurnInput): Promise<ChatResponse>;
  /** The seed partners, universities and licensable assets for the Partners page (#79). */
  getEcosystem(): Promise<Ecosystem>;
};

export const API_URL: string = import.meta.env.VITE_API_URL || "";
export const OFFLINE_DEMO: boolean = import.meta.env.VITE_OFFLINE_DEMO === "1";
