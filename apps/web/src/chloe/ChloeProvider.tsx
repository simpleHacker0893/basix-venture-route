import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { ChloeContext, useChloeConductor } from "./useChloe";

/**
 * Mounted in `RoutePage` (Sprint 006 blueprint): runs Chloe's conductor for the founder flow on
 * /route and cancels her speech and the mic when /route unmounts. `?mode=form` counts as a
 * user-driven view change.
 */
export function ChloeProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const value = useChloeConductor({ formMode: params.get("mode") === "form" });
  return <ChloeContext.Provider value={value}>{children}</ChloeContext.Provider>;
}
