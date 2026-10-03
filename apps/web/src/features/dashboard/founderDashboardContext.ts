/**
 * The founder's dashboard response, loaded once by `FounderDashboardProvider` (inside the shell)
 * and read by the sidebar badges, /dashboard and /ventures/:id, so the three never disagree and
 * the page makes one call. `null` outside the provider (builders, admins, tests that mount a page
 * on its own).
 */
import type { Dashboard } from "@venture-route/contracts";
import { createContext, useContext } from "react";

export type FounderDashboardValue = Readonly<{
  /** The last response that loaded; kept while a refresh is in flight or after a failed refresh. */
  data: Dashboard | null;
  /** The last load's error, cleared by the next success. */
  error: string | null;
}>;

export const FounderDashboardContext = createContext<FounderDashboardValue | null>(null);

export function useFounderDashboard(): FounderDashboardValue | null {
  return useContext(FounderDashboardContext);
}

/** The three numbers shown as tiles on Home and as badges in the sidebar (hidden at 0). */
export function founderCounts(data: Dashboard) {
  return {
    ventures: data.requests.length,
    bids: data.counts.bidsReceived,
    interviews: data.counts.bookings,
  };
}
