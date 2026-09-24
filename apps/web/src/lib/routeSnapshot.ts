/**
 * The route snapshot a founder publishes with a request (spec #52 §Store): what they saw,
 * `{status, totalDailyRate, builderIds}`. Display-only on the engine side; eligibility is
 * always recomputed over the graph.
 */
import type { RouteSnapshot, VentureRoute } from "@venture-route/contracts";

export function routeSnapshot(route: VentureRoute): RouteSnapshot {
  return {
    status: route.status,
    totalDailyRate: route.totalDailyRate,
    builderIds: route.builders.map((builder) => builder.builderId),
  };
}
