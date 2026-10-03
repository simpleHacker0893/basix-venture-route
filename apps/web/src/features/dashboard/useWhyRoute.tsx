/**
 * "Why this route?" from Home and the venture page: re-routes the request's stored brief through
 * the engine (the same call "View route" makes, nothing stored in the routing state) and opens the
 * existing WhyDrawer on the answer. The drawer shows the engine's reasoning paths as they come.
 */
import type { Request, VentureRoute } from "@venture-route/contracts";
import { useState, type ReactNode } from "react";

import { useRouting } from "../../state/routingContext";
import { errorMessage } from "../builder/formStyles";
import { WhyDrawer } from "../why/WhyDrawer";

export function useWhyRoute(): Readonly<{
  /** Starts loading for `request`; `busy` is the request id while it is in flight. */
  open(request: Request): Promise<void>;
  busy: string | null;
  error: string | null;
  drawer: ReactNode;
}> {
  const { source } = useRouting();
  const [route, setRoute] = useState<VentureRoute | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(request: Request) {
    setBusy(request.id);
    setError(null);
    try {
      setRoute(await source.postRoute(request.brief));
      setIsOpen(true);
    } catch (cause) {
      setError(errorMessage(cause, "The reasoning could not be loaded."));
    } finally {
      setBusy(null);
    }
  }

  const drawer = route ? <WhyDrawer route={route} open={isOpen} onOpenChange={setIsOpen} /> : null;
  return { open, busy, error, drawer };
}
