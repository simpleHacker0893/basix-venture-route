/** The amber "Demo data" pill on every seed-derived record (AGENTS.md rule 5). Never hidden. */
export function DemoDataPill({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill bg-amber-fill px-2 font-mono text-[11px] font-semibold text-amber-ink ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-ink" />
      Demo data
    </span>
  );
}
