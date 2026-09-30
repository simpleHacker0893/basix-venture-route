import type { AccountStatus, ShowcaseStatus } from "@venture-route/contracts";

const LABEL: Record<AccountStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

const CLASS: Record<AccountStatus, string> = {
  pending: "bg-amber-fill text-amber-ink",
  confirmed: "bg-accent-green text-white",
  rejected: "bg-danger text-white",
};

/** Confirmation state of an account, credential or project row as the engine reports it. */
export function StatusPill({ status }: Readonly<{ status: AccountStatus }>) {
  return (
    <span
      data-testid="status-pill"
      className={`inline-flex h-6 items-center rounded-pill px-2.5 text-[12px] font-medium ${CLASS[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}

/**
 * A showcase entry's own review status (spec #86 story 5): "Not shown" (`none`), "Pending
 * review", "Live" (`confirmed`) and "Rejected" — a separate four-state pill from `StatusPill`
 * above, which reports the project's own confirmation, not its Showcase visibility.
 */
const SHOWCASE_LABEL: Record<ShowcaseStatus, string> = {
  none: "Not shown",
  pending: "Pending review",
  confirmed: "Live",
  rejected: "Rejected",
};

const SHOWCASE_CLASS: Record<ShowcaseStatus, string> = {
  none: "bg-surface-strong text-ink-3 border border-border-strong",
  pending: "bg-amber-fill text-amber-ink",
  confirmed: "bg-accent-green text-white",
  rejected: "bg-danger text-white",
};

export function ShowcaseStatusPill({ status }: Readonly<{ status: ShowcaseStatus }>) {
  return (
    <span
      data-testid="showcase-status-pill"
      className={`inline-flex h-6 items-center rounded-pill px-2.5 text-[12px] font-medium ${SHOWCASE_CLASS[status]}`}
    >
      {SHOWCASE_LABEL[status]}
    </span>
  );
}

/** Card chrome shared by the profile and add-project screens (Stitch batch-3 cards). */
export function Card({
  title,
  eyebrow,
  lead,
  aside,
  children,
  className = "",
}: Readonly<{
  title: string;
  eyebrow?: string;
  lead?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section
      aria-label={title}
      className={`flex flex-col gap-4 rounded-card border border-border bg-surface p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {eyebrow ? <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{eyebrow}</span> : null}
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          {lead ? <p className="text-[13px] leading-relaxed text-ink-muted">{lead}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A checkbox drawn as the Stitch toggle switch; stays a native checkbox for keyboard and tests. */
export function Toggle({
  id,
  label,
  checked,
  onChange,
  description,
}: Readonly<{ id: string; label: string; checked: boolean; onChange(next: boolean): void; description?: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <span className="text-[12px] text-ink-3">{description}</span> : null}
      </div>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-6 w-11 cursor-pointer appearance-none rounded-pill border border-border-strong bg-surface-strong transition-colors checked:border-accent-green checked:bg-accent-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </div>
  );
}

/** Inline field error with the id the input points at through aria-describedby. */
export function FieldError({ field, errors }: Readonly<{ field: string; errors: Record<string, string> }>) {
  const text = errors[field];
  if (!text) return null;
  return (
    <p id={`error-${field}`} role="alert" className="text-[13px] text-danger">
      {text}
    </p>
  );
}
