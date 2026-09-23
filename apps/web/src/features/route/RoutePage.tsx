import { useEffect } from "react";

import { ApiBanner } from "../../components/ApiBanner";
import { usd } from "../../lib/format";
import { useRouting } from "../../state/routingContext";

/** Short chip labels for the seed scenarios (DESIGN.md intake prompt); other briefs use their title. */
const CHIP_LABELS: Record<string, string> = {
  "brief-health-01": "Health pilot",
  "brief-agri-01": "Agri marketplace",
  "brief-constrained-01": "Constrained brief",
  "brief-budget-01": "Budget challenge",
  "brief-onsite-01": "Delivery-mode challenge",
};

export function ScenarioChips() {
  const { state, loadScenarios, routeBrief } = useRouting();

  useEffect(() => {
    if (state.scenarios.length === 0) void loadScenarios();
    // Load once per source; the store keeps the list afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-wrap gap-2" aria-label="Demo scenarios">
      {state.scenarios.map((brief) => (
        <button
          key={brief.id}
          type="button"
          disabled={state.busy}
          onClick={() => void routeBrief(brief)}
          className="h-8 rounded-pill border border-border px-3 text-sm text-ink-2 hover:border-border-strong hover:text-ink disabled:opacity-60"
        >
          Load scenario: {CHIP_LABELS[brief.id] ?? brief.title}
        </button>
      ))}
    </div>
  );
}

/** Tracer bullet for #24: the raw route outcome as text. The route screen (#27) replaces it. */
function RawOutcome() {
  const { state } = useRouting();
  const response = state.lastResponse;
  if (!response) return null;
  if (response.type === "validation-error") {
    return (
      <p className="text-danger" data-testid="validation-error">
        {response.message}
      </p>
    );
  }
  if (response.type === "clarification") {
    return <p className="text-ink-2">Missing: {response.missingFields.join(", ")}</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
      <dt className="text-ink-3">status</dt>
      <dd>{response.route.status}</dd>
      <dt className="text-ink-3">total</dt>
      <dd>{usd(response.route.totalDailyRate)}</dd>
      <dt className="text-ink-3">builders</dt>
      <dd>{response.route.builders.map((b) => b.builderId).join(", ") || "none"}</dd>
    </dl>
  );
}

export function RoutePage() {
  return (
    <section className="flex flex-col gap-6">
      <ApiBanner />
      <div>
        <h1 className="font-display text-[36px] font-medium leading-tight">Describe your MVP</h1>
        <p className="text-ink-2">Plain language is fine. We will ask for anything missing.</p>
      </div>
      <ScenarioChips />
      <RawOutcome />
    </section>
  );
}
