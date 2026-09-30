import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { useFounderVoice } from "./founderVoice";
import { ChloeContext, useChloeConductor } from "./useChloe";

/**
 * Mounted in `RoutePage` (Sprint 006 blueprint): runs Chloe's conductor for the founder flow on
 * /route and cancels her speech and the mic when /route unmounts. `?mode=form` counts as a
 * user-driven view change. It hands its switch handler to the top-nav switch (#102).
 */
export function ChloeProvider({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const value = useChloeConductor({ formMode: params.get("mode") === "form" });
  // The top-nav switch calls this same toggleVoice, so its greeting lands in the thread (#102).
  const founder = useFounderVoice();
  const { toggleVoice } = value;
  useEffect(() => founder?.registerRouteToggle(toggleVoice), [founder, toggleVoice]);
  return <ChloeContext.Provider value={value}>{children}</ChloeContext.Provider>;
}
