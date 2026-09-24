/**
 * Renders the engine's `proposedStartLocal` (ISO 8601 already in Africa/Nairobi, `+03:00`) as
 * "Fri 25 Sep 2026 · 09:00 EAT" without any zone arithmetic in the browser (D-16): the date and
 * the clock time are read straight from the string; only the weekday is computed, from the
 * calendar date.
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function formatNairobi(local: string): string {
  const match = LOCAL.exec(local);
  if (!match) return local;
  const [, y, m, d, hh, mm] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  return `${weekday} ${day} ${MONTHS[month - 1] ?? ""} ${year} · ${hh}:${mm} EAT`;
}

/** The clock part only: "09:00 EAT". */
export function formatNairobiTime(local: string): string {
  const match = LOCAL.exec(local);
  return match ? `${match[4]}:${match[5]} EAT` : local;
}
