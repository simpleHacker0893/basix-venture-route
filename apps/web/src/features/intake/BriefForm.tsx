import { VentureBrief, type SkillId, type VentureBrief as VentureBriefT } from "@venture-route/contracts";
import { useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODES, MODE_LABELS, SKILLS, SKILL_LABELS, VERTICALS, VERTICAL_LABELS, briefIdFor } from "../../lib/brief";
import { dateRange } from "../../lib/format";

type BriefFormProps = Readonly<{
  busy: boolean;
  onSubmit(brief: VentureBriefT): void;
  onBack(): void;
}>;

type Draft = {
  title: string;
  vertical: string;
  requiredSkills: SkillId[];
  maximumTeamSize: string;
  range: DateRange | undefined;
  deliveryMode: string;
  location: string;
  dailyBudget: string;
  preferReusableIp: boolean;
};

const EMPTY: Draft = {
  title: "",
  vertical: "",
  requiredSkills: [],
  maximumTeamSize: "3",
  range: undefined,
  deliveryMode: "",
  location: "",
  dailyBudget: "",
  preferReusableIp: false,
};

/** Demo clock (D-14): the calendar opens on September 2026 where the seed availability lives. */
const DEMO_MONTH = new Date(2026, 8, 1);

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toInput(draft: Draft): unknown {
  return {
    id: briefIdFor(draft.title),
    title: draft.title.trim(),
    vertical: draft.vertical || undefined,
    requiredSkills: draft.requiredSkills,
    maximumTeamSize: draft.maximumTeamSize === "" ? undefined : Number(draft.maximumTeamSize),
    availabilityStart: draft.range?.from ? iso(draft.range.from) : undefined,
    availabilityEnd: draft.range?.to ? iso(draft.range.to) : undefined,
    deliveryMode: draft.deliveryMode || undefined,
    location: draft.deliveryMode === "on-site" ? draft.location.trim() || undefined : null,
    dailyBudget: draft.dailyBudget === "" ? undefined : Number(draft.dailyBudget),
    preferReusableIp: draft.preferReusableIp,
    demoData: true,
  };
}

/** Structured-form fallback (requirements.md In scope 3): the full brief to POST /api/route. */
export function BriefForm({ busy, onSubmit, onBack }: BriefFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = VentureBrief.safeParse(toInput(draft));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      if (draft.deliveryMode === "on-site" && !draft.location.trim()) {
        next.location = "Location is required for on-site delivery";
      }
      setErrors(next);
      return;
    }
    if (parsed.data.deliveryMode === "on-site" && !parsed.data.location) {
      setErrors({ location: "Location is required for on-site delivery" });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  const error = (field: string) =>
    errors[field] ? (
      <p role="alert" className="text-[13px] text-danger">
        {errors[field]}
      </p>
    ) : null;

  const rangeLabel =
    draft.range?.from && draft.range.to
      ? dateRange(iso(draft.range.from), iso(draft.range.to))
      : draft.range?.from
        ? `${iso(draft.range.from)} – …`
        : "Pick a start and end date";

  return (
    <form
      aria-label="Venture brief"
      onSubmit={submit}
      noValidate
      className="grid grid-cols-1 gap-6 rounded-card border border-border bg-surface p-6 md:grid-cols-2"
    >
      <div className="flex flex-col gap-1 md:col-span-2">
        <label htmlFor="brief-title" className="text-[13px] text-ink-2">
          Title
        </label>
        <input
          id="brief-title"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-10 rounded-card border border-border-strong bg-surface-strong px-3"
        />
        {error("title")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] text-ink-2">Vertical</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Vertical">
          {VERTICALS.map((vertical) => (
            <label
              key={vertical}
              className={`inline-flex h-8 cursor-pointer items-center rounded-pill border px-3 text-sm ${
                draft.vertical === vertical ? "border-accent-green bg-accent-green text-white" : "border-border-strong bg-surface-strong"
              }`}
            >
              <input
                type="radio"
                name="vertical"
                value={vertical}
                checked={draft.vertical === vertical}
                onChange={() => patch({ vertical })}
                className="sr-only"
              />
              {VERTICAL_LABELS[vertical]}
            </label>
          ))}
        </div>
        {error("vertical")}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] text-ink-2">Required skills</legend>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => {
            const checked = draft.requiredSkills.includes(skill);
            return (
              <label
                key={skill}
                className={`inline-flex h-8 cursor-pointer items-center rounded-pill border px-3 text-sm ${
                  checked ? "border-accent-green bg-accent-green text-white" : "border-border-strong bg-surface-strong"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    patch({
                      requiredSkills: checked
                        ? draft.requiredSkills.filter((s) => s !== skill)
                        : [...draft.requiredSkills, skill],
                    })
                  }
                  className="sr-only"
                />
                {SKILL_LABELS[skill]}
              </label>
            );
          })}
        </div>
        {error("requiredSkills")}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="brief-team-size" className="text-[13px] text-ink-2">
          Maximum team size
        </label>
        <input
          id="brief-team-size"
          type="number"
          min={1}
          max={5}
          value={draft.maximumTeamSize}
          onChange={(e) => patch({ maximumTeamSize: e.target.value })}
          className="h-10 w-24 rounded-card border border-border-strong bg-surface-strong px-3 font-mono"
        />
        {error("maximumTeamSize")}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-2">Availability</span>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center rounded-card border border-border-strong bg-surface-strong px-3 text-left font-mono text-sm"
            >
              <span className="sr-only">Availability: </span>
              {rangeLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={DEMO_MONTH}
              selected={draft.range}
              onSelect={(range) => patch({ range })}
            />
          </PopoverContent>
        </Popover>
        {error("availabilityStart") ?? error("availabilityEnd")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] text-ink-2">Delivery mode</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Delivery mode">
          {MODES.map((mode) => (
            <label
              key={mode}
              className={`inline-flex h-8 cursor-pointer items-center rounded-pill border px-3 text-sm ${
                draft.deliveryMode === mode ? "border-accent-green bg-accent-green text-white" : "border-border-strong bg-surface-strong"
              }`}
            >
              <input
                type="radio"
                name="deliveryMode"
                value={mode}
                checked={draft.deliveryMode === mode}
                onChange={() => patch({ deliveryMode: mode })}
                className="sr-only"
              />
              {MODE_LABELS[mode]}
            </label>
          ))}
        </div>
        {error("deliveryMode")}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="brief-location" className="text-[13px] text-ink-2">
          Location
        </label>
        <input
          id="brief-location"
          value={draft.location}
          disabled={draft.deliveryMode !== "on-site"}
          onChange={(e) => patch({ location: e.target.value })}
          className="h-10 rounded-card border border-border-strong bg-surface-strong px-3 disabled:opacity-60"
        />
        <span className="text-[13px] text-ink-3">Required only for on-site</span>
        {error("location")}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="brief-budget" className="text-[13px] text-ink-2">
          Daily budget
        </label>
        <div className="flex h-10 items-center rounded-card border border-border-strong bg-surface-strong px-3 font-mono">
          <span className="text-ink-3">USD</span>
          <input
            id="brief-budget"
            type="number"
            min={1}
            value={draft.dailyBudget}
            onChange={(e) => patch({ dailyBudget: e.target.value })}
            className="w-24 bg-transparent px-2 focus:outline-none"
          />
          <span className="text-ink-3">/ day</span>
        </div>
        {error("dailyBudget")}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="brief-ip"
          type="checkbox"
          checked={draft.preferReusableIp}
          onChange={(e) => patch({ preferReusableIp: e.target.checked })}
          className="h-4 w-4 accent-accent-green"
        />
        <label htmlFor="brief-ip" className="text-sm">
          Prefer reusable IP
        </label>
      </div>

      {error("form")}
      <div className="flex items-center justify-end gap-3 md:col-span-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to chat
        </Button>
        <Button type="submit" disabled={busy}>
          Find my route
        </Button>
      </div>
    </form>
  );
}
