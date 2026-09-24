/**
 * "Publish as request" on the route result (Sprint 004, #71; PRD §3.2). A signed-in founder
 * publishes the brief and route they just saw without re-entering anything: the client posts
 * what it holds (approach chosen by the Operator, spec #52 §Web): the routing store's current
 * brief and a snapshot `{status, totalDailyRate, builderIds}` of the last response's route.
 *
 * The snapshot is display-only. The engine validates the brief again as a VentureBrief and
 * answers every eligibility question by running `eligible-builder` over the graph (#61, #62);
 * it never reads the snapshot for eligibility (docs/API.md §Requests). Signed-out visitors and
 * builders see nothing here; #72 adds "Sign in to publish" for visitors.
 */
import type { VentureBrief, VentureRoute } from "@venture-route/contracts";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import { ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { routeSnapshot } from "../../lib/routeSnapshot";
import { errorMessage } from "../builder/formStyles";

type Props = Readonly<{ brief: VentureBrief; route: VentureRoute }>;

export function PublishRequestButton({ brief, route }: Props) {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.isLoaded || !auth.isSignedIn || auth.role !== "founder") return null;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await api.postRequest({ brief, route: routeSnapshot(route) });
      await navigate("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof ApiValidationError
          ? cause.message
          : errorMessage(cause, "The request could not be published."),
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => void publish()} disabled={busy}>
        {busy ? "Publishing…" : "Publish as request"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="basis-full rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
