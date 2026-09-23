/** Infeasible and budget-gap routes: no builder cards, one honest empty state. */
export function EmptyTeam() {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-dashed border-border-strong bg-surface p-6">
      <p className="text-lg font-semibold">No verified builder fits this brief yet</p>
      <p className="text-sm text-ink-2">
        Self-described skills never count as evidence. Change a constraint through a next action above.
      </p>
    </div>
  );
}
