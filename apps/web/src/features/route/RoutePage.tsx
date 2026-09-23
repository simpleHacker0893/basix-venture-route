import { useSearchParams } from "react-router";

import { useRouting } from "../../state/routingContext";
import { IntakePage } from "../intake/IntakePage";
import { ReviewPage } from "../review/ReviewPage";
import { RouteResultPage } from "./RouteResultPage";

/** /route: intake → review → result, driven by the store's `view` (blueprint router). */
export function RoutePage() {
  const { state } = useRouting();
  const [params] = useSearchParams();
  if (state.view === "review") return <ReviewPage />;
  if (state.view === "result") return <RouteResultPage />;
  return <IntakePage initialMode={params.get("mode") === "form" ? "form" : "chat"} />;
}
