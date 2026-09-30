/**
 * The booking slot grid on the client (spec #52, Operator's slot rules): any date inside the
 * builder's confirmed availability ranges, any start on the 30-minute grid from 08:00 to 18:00
 * Africa/Nairobi (18:00 is the last start), duration 30 or 45 minutes. The engine enforces the
 * same rules (`slots.py`); the browser only offers what can pass. A proposal is sent as an ISO
 * string carrying the +03:00 offset, so no zone arithmetic happens here (D-16).
 */
import type { AvailabilityRange } from "@venture-route/contracts";

import { iso } from "./dates";
import { formatNairobi } from "./nairobi";

export const DURATIONS = [30, 45] as const;
export type Duration = (typeof DURATIONS)[number];

/** "08:00" … "18:00", every 30 minutes: 21 starts. */
export const GRID_STARTS: readonly string[] = Array.from({ length: 21 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** True when the calendar day lies inside one of the builder's confirmed ranges. */
export function inAvailability(day: Date, ranges: readonly AvailabilityRange[]): boolean {
  const date = iso(day);
  return ranges.some((range) => range.start <= date && date <= range.end);
}

/** `2026-09-24` + `10:30` → `2026-09-24T10:30:00+03:00`, the wire form of a proposal. */
export function localIso(day: Date, start: string): string {
  return `${iso(day)}T${start}:00+03:00`;
}

/** `10:30` + 45 → `11:15`. */
export function endOf(start: string, durationMin: Duration): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + durationMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** What the slot picker holds before a proposal is sent. */
export type SlotDraft = { day: Date | undefined; start: string | null; durationMin: Duration; note: string };

export const EMPTY_SLOT: SlotDraft = { day: undefined, start: null, durationMin: 30, note: "" };

/** "Thu 24 Sep 2026 · 10:30 – 11:15 EAT" for the summary, or null until day and start are chosen. */
export function summaryOf(draft: SlotDraft): string | null {
  if (!draft.day || !draft.start) return null;
  const local = formatNairobi(localIso(draft.day, draft.start));
  return `${local.replace(" EAT", "")} – ${endOf(draft.start, draft.durationMin)} EAT`;
}
