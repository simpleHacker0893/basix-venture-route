import { useSearchParams } from "react-router";

import { useRouting } from "../../state/routingContext";
import { IntakePage } from "../intake/IntakePage";
import { ReviewPage } from "../review/ReviewPage";
import { RouteResultPage } from "./RouteResultPage";

/** /route: intake → review → result, driven by the store's `view` (blueprint router). */
export function RoutePage() {
  const { state } = useRouting();
  const [params] = useSearchParams();
  const page =
    state.view === "review" ? (
      <ReviewPage />
    ) : state.view === "result" ? (
      <RouteResultPage />
    ) : (
      <IntakePage initialMode={params.get("mode") === "form" ? "form" : "chat"} />
    );
  return <div className="mx-auto w-full max-w-[1200px] px-6 py-12">{page}</div>;
}
