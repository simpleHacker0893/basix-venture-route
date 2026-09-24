/**
 * The slot picker shared by the propose screen (#74) and the counter variant (#75): a
 * single-month Calendar with days outside the builder's confirmed availability disabled, the
 * 30-minute start grid 08:00 to 18:00 EAT, the 30 | 45 minute choice, the note and a summary.
 * Stitch's four fixed slots and "30-min buffer" are not adopted (D-36 substitution).
 */
import type { AvailabilityRange } from "@venture-route/contracts";

import { Calendar } from "@/components/ui/calendar";

import { DEMO_MONTH, fromIso } from "../../lib/dates";
import { dateRange } from "../../lib/format";
import { DURATIONS, GRID_STARTS, inAvailability, summaryOf, type SlotDraft } from "../../lib/slots";
import { helpClass, inputClass, labelClass, pillClass } from "../builder/formStyles";

type Props = Readonly<{
  availability: readonly AvailabilityRange[];
  draft: SlotDraft;
  onChange(next: SlotDraft): void;
  summaryLead?: string;
  errors?: Record<string, string>;
}>;

export function SlotPicker({ availability, draft, onChange, summaryLead, errors = {} }: Props) {
  const firstStart = availability[0]?.start;
  const summary = summaryOf(draft);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-7">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold text-ink">Select date &amp; time slot</h2>
          <p className={helpClass}>
            {availability.length > 0
              ? `Builder verified availability window: ${availability
                  .map((range) => dateRange(range.start, range.end))
                  .join("; ")}`
              : "This builder has no confirmed availability on record."}
          </p>
        </div>
        <div className="w-fit rounded-card border border-border bg-surface-strong">
          <Calendar
            mode="single"
            numberOfMonths={1}
            defaultMonth={draft.day ?? (firstStart ? fromIso(firstStart) : DEMO_MONTH)}
            selected={draft.day}
            onSelect={(day) => onChange({ ...draft, day })}
            disabled={(day) => !inAvailability(day, availability)}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Start time</legend>
          <div role="radiogroup" aria-label="Start time" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {GRID_STARTS.map((start) => (
              <button
                key={start}
                type="button"
                role="radio"
                aria-checked={draft.start === start}
                aria-label={`${start} EAT`}
                onClick={() => onChange({ ...draft, start })}
                className={pillClass(draft.start === start)}
              >
                {start}
              </button>
            ))}
          </div>
          {errors.proposedStart ? (
            <p id="error-proposedStart" role="alert" className="text-[13px] text-danger">
              {errors.proposedStart}
            </p>
          ) : null}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Duration</legend>
          <div role="radiogroup" aria-label="Duration" className="flex gap-2">
            {DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                role="radio"
                aria-checked={draft.durationMin === duration}
                onClick={() => onChange({ ...draft, durationMin: duration })}
                className={pillClass(draft.durationMin === duration)}
              >
                {duration} min
              </button>
            ))}
          </div>
          {errors.durationMin ? (
            <p role="alert" className="text-[13px] text-danger">
              {errors.durationMin}
            </p>
          ) : null}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-note" className={labelClass}>
            Notes to builder (optional)
          </label>
          <textarea
            id="booking-note"
            value={draft.note}
            maxLength={500}
            rows={3}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            className={`${inputClass} h-auto py-2`}
          />
          {errors.note ? (
            <p role="alert" className="text-[13px] text-danger">
              {errors.note}
            </p>
          ) : null}
        </div>
      </div>
      <aside data-testid="summary" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 lg:col-span-5">
        <h2 className="font-display text-xl font-semibold text-ink">Summary</h2>
        {summaryLead ? <p className="text-[13px] text-ink-muted">{summaryLead}</p> : null}
        <p className="font-mono text-sm text-ink">{summary ?? "Pick a day and a start time."}</p>
        <p className={helpClass}>Times are shown in Africa/Nairobi. The builder can accept or counter from their side.</p>
      </aside>
    </div>
  );
}
