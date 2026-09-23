import type { PartialBriefInput } from "@venture-route/contracts";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Button } from "@/components/ui/button";
import { missingFields } from "../../lib/brief";
import { briefChips } from "../../lib/briefChips";

type BriefPanelProps = Readonly<{
  brief: PartialBriefInput | null;
  onFindRoute(): void;
}>;

export function BriefPanel({ brief, onFindRoute }: BriefPanelProps) {
  const missing = missingFields(brief);
  const chips = briefChips(brief);
  // "Dates" is one chip for two fields; count distinct chips still missing.
  const missingChips = chips.filter((chip) => chip.value === null);
  const filled = chips.length - missingChips.length;
  const complete = missing.length === 0;

  return (
    <aside
      aria-label="Your brief so far"
      className="sticky top-20 flex flex-col gap-4 rounded-card border border-border bg-surface p-6"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-xl font-semibold">Your brief so far</h2>
        <span className="rounded-pill border border-border bg-surface-strong px-2 py-0.5 text-[13px] text-ink-2">
          {filled} / {chips.length} filled
        </span>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Brief fields">
        {chips.map((chip) =>
          chip.value === null ? (
            <li
              key={chip.field}
              className="inline-flex h-8 items-center gap-1 rounded-pill border border-dashed border-border-strong px-3 text-sm text-ink-3"
            >
              <span>{chip.label}:</span>
              <span className="italic text-danger">missing</span>
            </li>
          ) : (
            <li
              key={chip.field}
              className="inline-flex h-8 items-center gap-1 rounded-pill border border-border-strong bg-surface-strong px-3 text-sm text-ink"
            >
              <span className="text-ink-3">{chip.label}:</span>
              <span className={chip.field === "dailyBudget" ? "font-mono" : "font-medium"}>{chip.value}</span>
            </li>
          ),
        )}
      </ul>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button type="button" className="w-full" disabled={!complete} onClick={onFindRoute}>
          Find my route
        </Button>
        {!complete && (
          <p className="text-center text-[13px] text-ink-3">Fill the missing fields to continue.</p>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-ground p-4">
        <DemoDataPill />
        <p className="text-[13px] leading-relaxed text-ink-3">
          Routes are computed by MeTTa rules over demo records. The assistant only translates your
          words.
        </p>
      </div>
    </aside>
  );
}
