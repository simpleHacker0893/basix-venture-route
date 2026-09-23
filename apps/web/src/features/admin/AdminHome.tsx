/** Placeholder admin home (Sprint 003 #44); ticket #46 replaces it with the confirmation queue. */
export function AdminHome() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-ink">Confirmation queue</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
        Pending accounts, credentials and projects arrive with the next ticket.
      </p>
    </div>
  );
}
