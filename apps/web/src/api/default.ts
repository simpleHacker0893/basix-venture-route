import { createApiSource } from "./client";
import { createOfflineSource } from "./offline";
import { API_URL, OFFLINE_DEMO, type RouteSource } from "./source";

/** Production wiring: the offline snapshot when VITE_OFFLINE_DEMO=1, else the engine at VITE_API_URL. */
export function createDefaultSource(): RouteSource {
  return OFFLINE_DEMO ? createOfflineSource() : createApiSource(API_URL);
}
