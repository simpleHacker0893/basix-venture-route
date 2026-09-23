/** Date-only helpers (AGENTS.md: ISO `YYYY-MM-DD`, Africa/Nairobi, no time component). */

/** Local calendar date → `2026-09-22`. */
export function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `2026-09-22` → local calendar date (never parsed as UTC midnight). */
export function fromIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
}

/** Demo clock (D-14): calendars open on September 2026 where the seed availability lives. */
export const DEMO_MONTH = new Date(2026, 8, 1);
