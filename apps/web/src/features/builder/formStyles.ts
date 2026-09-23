/** Shared field styling and error helpers for the builder screens (no components; react-refresh safe). */

export const inputClass =
  "h-10 rounded-card border border-border-strong bg-surface-strong px-3 text-sm focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-60";

export const labelClass = "text-[13px] text-ink-2";

export const helpClass = "text-[12px] leading-relaxed text-ink-3";

/** Selected/unselected pill for radio and checkbox groups (same look as the brief editor). */
export function pillClass(selected: boolean): string {
  return `inline-flex h-8 cursor-pointer items-center rounded-pill border px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/50 has-focus-visible:ring-offset-1 has-disabled:cursor-not-allowed has-disabled:opacity-50 ${
    selected ? "border-accent-green bg-accent-green text-white" : "border-border-strong bg-surface-strong hover:border-accent-green"
  }`;
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
