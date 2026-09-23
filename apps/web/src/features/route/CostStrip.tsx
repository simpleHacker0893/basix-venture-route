import { usd } from "../../lib/format";

type CostStripProps = Readonly<{ totalDailyRate: number; dailyBudget: number }>;

/** `USD <total> / day` against `USD <budget> / day` (requirements.md Business rules). */
export function CostStrip({ totalDailyRate, dailyBudget }: CostStripProps) {
  const headroom = dailyBudget - totalDailyRate;
  return (
    <section
      data-testid="cost-strip"
      aria-label="Cost"
      className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface p-6 md:grid-cols-3"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-3">Total day rate</span>
        <span className="font-mono text-xl">{usd(totalDailyRate)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-3">Your budget</span>
        <span className="font-mono text-xl">{usd(dailyBudget)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-3">{headroom >= 0 ? "Budget headroom" : "Over budget by"}</span>
        <span className={`font-mono text-xl ${headroom >= 0 ? "text-accent-green" : "text-danger"}`}>
          {usd(Math.abs(headroom))}
        </span>
      </div>
    </section>
  );
}
