import { useSearchParams } from "react-router";

import { useRouting } from "../../state/routingContext";
import { IntakePage } from "../intake/IntakePage";
import { ReviewPage } from "../review/ReviewPage";
import { RouteResultPage } from "./RouteResultPage";

/**
 * /route: intake → review → result, driven by the store's `view` (blueprint router).
 * `?mode=form` always shows the structured form (the API banner's fallback link), whatever the view.
 */
export function RoutePage() {
  const { state } = useRouting();
  const [params] = useSearchParams();
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
  return <div className="mx-auto w-full max-w-[1200px] px-6 py-12">{page}</div>;
}
