/**
 * The amber "Demo data" pill on every seed-derived record (AGENTS.md rule 5). Never hidden.
 * `strong` is the warmer fill for hero surfaces where the pill sits beside other tinted badges.
 */
export function DemoDataPill({ className = "", tone = "soft" }: Readonly<{ className?: string; tone?: "soft" | "strong" }>) {
  const fill = tone === "strong" ? "bg-[#ecc98f]" : "bg-amber-fill";
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill ${fill} px-2.5 font-mono text-[11px] font-medium text-amber-ink ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-ink" />
      Demo data
    </span>
  );
}
