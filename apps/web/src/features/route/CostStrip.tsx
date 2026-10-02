import { usdPerHour } from "../../lib/format";

type CostStripProps = Readonly<{ totalHourlyRate: number; hourlyBudget: number }>;

/** `USD <total> an hour` against `USD <budget> an hour` (D-59). */
export function CostStrip({ totalHourlyRate, hourlyBudget }: CostStripProps) {
  const headroom = hourlyBudget - totalHourlyRate;
  const used = hourlyBudget > 0 ? Math.min(100, Math.round((totalHourlyRate / hourlyBudget) * 100)) : 0;
  const cell = "flex flex-col gap-1 bg-surface-strong px-6 py-5";
  const label = "font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3";
  return (
    <section
      data-testid="cost-strip"
      aria-label="Cost"
      className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-3"
    >
      <div className={cell}>
        <span className={label}>Total hourly rate</span>
        <span className="font-display text-[26px] sm:text-3xl text-ink">{usdPerHour(totalHourlyRate)}</span>
      </div>
      <div className={cell}>
        <span className={label}>Your budget</span>
        <span className="font-display text-[26px] sm:text-3xl text-ink">{usdPerHour(hourlyBudget)}</span>
      </div>
      <div className={cell}>
        <span className={label}>{headroom >= 0 ? "Budget headroom" : "Over budget by"}</span>
        <div className="flex items-center gap-3">
          <span className={`font-display text-[26px] sm:text-3xl ${headroom >= 0 ? "text-accent-green" : "text-danger"}`}>
            {usdPerHour(Math.abs(headroom))}
          </span>
          <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-pill bg-border">
            <span
              className={`block h-full rounded-pill ${headroom >= 0 ? "bg-accent-green" : "bg-danger"}`}
              style={{ width: `${used}%` }}
            />
          </span>
        </div>
      </div>
    </section>
  );
}
