import { CHIP_LABELS } from "../../lib/brief";
import { useRouting } from "../../state/routingContext";

/** "Load scenario" chips from GET /api/scenarios; a click opens the review step with that brief. */
export function ScenarioChips() {
  const { state, loadScenario } = useRouting();
  if (state.scenarios.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Demo scenarios">
      <span className="mr-1 text-[13px] text-ink-3">Demo briefs:</span>
      {state.scenarios.map((brief) => (
        <button
          key={brief.id}
          type="button"
          disabled={state.busy}
          onClick={() => loadScenario(brief)}
          className="h-7 rounded-pill border border-border bg-surface-strong px-3 text-[13px] text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-60"
        >
          Load scenario: {CHIP_LABELS[brief.id] ?? brief.title}
        </button>
      ))}
    </div>
  );
}
