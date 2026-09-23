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
      className="flex flex-col gap-4 rounded-card border border-amber-fill bg-amber-fill/20 p-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="gaps-heading" className="text-xl font-semibold">
          Gaps ({gaps.length})
        </h2>
        <span className="text-[13px] text-ink-3">Named by the engine; only its next actions are offered.</span>
      </div>
      <ul className="flex flex-col gap-4">
        {gaps.map((gap, index) => (
          <li key={`${gap.category}-${gap.affected.join("-")}-${index}`} data-testid="gap" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-pill bg-dark px-2 py-0.5 font-mono text-[12px] text-accent-on-dark">{gap.rule}</span>
              <span className="rounded-pill border border-amber-ink/40 px-2 py-0.5 capitalize text-amber-ink">{gap.category}</span>
              <span className="text-ink-2">
                Affected: <span className="font-mono">{gap.affected.join(", ")}</span>
              </span>
            </div>
            <p className="leading-relaxed">{gap.statement}</p>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-ink-3">Approved next actions</span>
              <div className="flex flex-wrap gap-2">
                {gap.nextActions.map((action) => {
                  const patch = patchForAction(gap, action);
                  return patch ? (
                    <Button key={action} type="button" variant="secondary" onClick={() => onPatch(patch)}>
                      {action}
                    </Button>
                  ) : (
                    <Button key={action} type="button" variant="secondary" disabled title="Suggestion from the engine">
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
