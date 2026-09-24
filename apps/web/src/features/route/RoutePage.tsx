import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { ChloeProvider } from "../../chloe/ChloeProvider";
import { clearStash, readStash } from "../../lib/publishStash";
import { useRouting } from "../../state/routingContext";
import { IntakePage } from "../intake/IntakePage";
import { ReviewPage } from "../review/ReviewPage";
import { RouteResultPage } from "./RouteResultPage";

/**
 * /route: intake → review → result, driven by the store's `view` (blueprint router).
 * `?mode=form` always shows the structured form (the API banner's fallback link), whatever the view.
 * On mount a publish stash left by "Sign in to publish" (#72) is restored through the hydrate
 * action and cleared, so the founder who just signed in lands on the same route result.
 */
export function RoutePage() {
  const { state, hydrate } = useRouting();
  const [params] = useSearchParams();

  useEffect(() => {
    const stash = readStash();
    if (stash === null) return;
    clearStash();
    hydrate(stash.brief, stash.route);
  }, [hydrate]);
  const formMode = params.get("mode") === "form";
  const page = formMode ? (
    <IntakePage />
  ) : state.view === "review" ? (
    <ReviewPage />
  ) : state.view === "result" ? (
    <RouteResultPage />
  ) : (
    <IntakePage />
  );
  return (
    <ChloeProvider>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-12">{page}</div>
    </ChloeProvider>
  );
}
