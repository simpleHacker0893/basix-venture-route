import { useSearchParams } from "react-router";

import { ApiBanner } from "../../components/ApiBanner";
import { Button } from "@/components/ui/button";
import { usd } from "../../lib/format";
import { useRouting } from "../../state/routingContext";
import { IntakePage } from "../intake/IntakePage";
import { ReviewPage } from "../review/ReviewPage";

/** Tracer bullet for #24: the raw route outcome as text. The route result screen (#27) replaces it. */
function RawOutcome() {
  const { state, showView } = useRouting();
  const response = state.lastResponse;
  if (!response || response.type !== "route") return null;
  return (
    <section className="flex flex-col gap-6">
      <ApiBanner />
      <h1 className="font-display text-[36px] font-medium leading-tight">Your route</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
        <dt className="text-ink-3">status</dt>
        <dd>{response.route.status}</dd>
        <dt className="text-ink-3">total</dt>
        <dd>{usd(response.route.totalDailyRate)}</dd>
        <dt className="text-ink-3">builders</dt>
        <dd>{response.route.builders.map((b) => b.builderId).join(", ") || "none"}</dd>
      </dl>
      <div>
        <Button type="button" variant="ghost" onClick={() => showView("review")}>
          Back to the brief
        </Button>
      </div>
    </section>
  );
}

/** /route: intake → review → result, driven by the store's `view` (blueprint router). */
export function RoutePage() {
  const { state } = useRouting();
  const [params] = useSearchParams();
  if (state.view === "review") return <ReviewPage />;
  if (state.view === "result") return <RawOutcome />;
  return <IntakePage initialMode={params.get("mode") === "form" ? "form" : "chat"} />;
}
