import type { Dashboard } from "@venture-route/contracts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { errorMessage } from "../builder/formStyles";
import { FounderDashboardContext, type FounderDashboardValue } from "./founderDashboardContext";

/**
 * Loads GET /api/me/dashboard for a signed-in founder, again on every navigation so the badges and
 * the pages are never stale after a bid, a booking or a publish. The previous response stays
 * visible while the next one loads.
 */
export function FounderDashboardProvider({ children }: Readonly<{ children: ReactNode }>) {
  const api = useMarketplaceApi();
  const { pathname } = useLocation();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, "The dashboard could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api, pathname]);

  const value = useMemo<FounderDashboardValue>(() => ({ data, error }), [data, error]);
  return <FounderDashboardContext.Provider value={value}>{children}</FounderDashboardContext.Provider>;
}
