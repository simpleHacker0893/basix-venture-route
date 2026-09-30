import type { Gap } from "@venture-route/contracts";

import { Button } from "@/components/ui/button";
import { patchForAction, type BriefPatch } from "../../lib/nextActions";

type GapsPanelProps = Readonly<{
  gaps: Gap[];
  /** A budget or team-size action pre-fills the review chip with the new value. */
  onPatch(patch: BriefPatch): void;
}>;

/**
 * The Gaps panel. Rendered before the team section in the JSX tree whenever the route has gaps
 * (AGENTS.md rule 6). Each gap: statement, rule name in mono, one button per nextActions entry
 * in order (D-29).
 */
export function GapsPanel({ gaps, onPatch }: GapsPanelProps) {
  if (gaps.length === 0) return null;
  return (
    <section
      data-testid="gaps-panel"
      aria-labelledby="gaps-heading"
      className="flex flex-col overflow-hidden rounded-card border border-danger/25 bg-surface-strong"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-danger-tint px-6 py-4">
        <h2 id="gaps-heading" className="text-[17px] font-semibold text-danger">
          Gaps ({gaps.length})
        </h2>
        <span className="text-[13px] text-danger/80">Named by the engine; only its next actions are offered.</span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {gaps.map((gap, index) => (
          <li key={`${gap.category}-${gap.affected.join("-")}-${index}`} data-testid="gap" className="flex flex-col gap-3 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span translate="no" className="rounded-pill bg-danger-tint px-2.5 py-0.5 font-mono text-[12px] text-danger">{gap.rule}</span>
              <span className="rounded-pill border border-border-strong bg-surface px-2.5 py-0.5 capitalize text-ink-2">{gap.category}</span>
              <span className="text-ink-2">
                Affected: <span className="font-mono">{gap.affected.join(", ")}</span>
              </span>
            </div>
            <p className="text-[15px] font-medium leading-relaxed text-ink">{gap.statement}</p>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">Approved next actions</span>
              <div className="flex flex-wrap gap-2">
                {gap.nextActions.map((action) => {
                  const patch = patchForAction(gap, action);
                  return patch ? (
                    <Button
                      key={action}
                      type="button"
                      variant="secondary"
                      className="h-auto min-h-10 max-w-full shrink whitespace-normal py-2 text-left"
                      onClick={() => onPatch(patch)}
                    >
                      {action}
                    </Button>
                  ) : (
                    <Button
                      key={action}
                      type="button"
                      variant="secondary"
                      aria-disabled="true"
                      className="h-auto min-h-10 max-w-full shrink whitespace-normal py-2 text-left opacity-60"
                      onClick={(event) => event.preventDefault()}
                    >
                      {action}
                    </Button>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
