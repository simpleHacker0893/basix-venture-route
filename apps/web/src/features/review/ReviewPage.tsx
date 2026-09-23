import { VentureBrief } from "@venture-route/contracts";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Button } from "@/components/ui/button";
import { toBriefInput } from "../../lib/brief";
import { useRouting } from "../../state/routingContext";
import { briefChips } from "../../lib/briefChips";

/**
 * Screen 4, first cut (#25): confirm the brief and find the route. Editable chips, Zod
 * re-validation and field-level validation errors arrive with #26.
 */
export function ReviewPage() {
  const { state, routeBrief, showView } = useRouting();
  const input = state.currentBrief ? toBriefInput(state.currentBrief) : null;
  const parsed = input ? VentureBrief.safeParse(input) : null;
  const serverError = state.lastResponse?.type === "validation-error" ? state.lastResponse.message : null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[36px] font-medium leading-tight">Confirm your brief</h1>
        <p className="text-ink-2">Edit anything that is wrong. Your latest correction wins.</p>
      </div>
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6">
        <ul className="flex flex-wrap gap-2" aria-label="Brief fields">
          {briefChips(state.currentBrief).map((chip) => (
            <li
              key={chip.field}
              className="inline-flex h-8 items-center gap-1 rounded-pill border border-border-strong bg-surface-strong px-3 text-sm"
            >
              <span className="text-ink-3">{chip.label}:</span>
              <span className="font-medium">{chip.value ?? "missing"}</span>
            </li>
          ))}
        </ul>
        {serverError && (
          <p className="text-[13px] text-danger" data-testid="validation-error">
            {serverError}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => showView("intake")}>
            Back to chat
          </Button>
          <Button
            type="button"
            disabled={!parsed?.success || state.busy}
            onClick={() => parsed?.success && void routeBrief(parsed.data)}
          >
            Find my route
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[13px] text-ink-3">
        <DemoDataPill />
        <span>Routing uses named MeTTa rules. Nothing here is decided by a language model.</span>
      </div>
    </section>
  );
}
