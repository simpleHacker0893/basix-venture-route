import { VentureBrief, type PartialBriefInput, type SkillId, type VentureBrief as VentureBriefT } from "@venture-route/contracts";
import { useMemo, useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODES, MODE_LABELS, REQUIRED_FIELDS, SKILLS, SKILL_LABELS, VERTICALS, VERTICAL_LABELS, briefIdFor } from "../../lib/brief";
import { DEMO_MONTH, fromIso, iso } from "../../lib/dates";
import { dateRange } from "../../lib/format";
import { FIELD_ALIASES, splitFieldMessages } from "../../lib/validationError";

type BriefEditorProps = Readonly<{
  /** Pre-fills the editor (review) or starts empty (intake form). */
  initial?: PartialBriefInput | null;
  busy: boolean;
  /** An engine `validation-error` message; mapped to a field by its prefix. */
  serverError?: string | null;
  onSubmit(brief: VentureBriefT): void;
  onBack(): void;
  backLabel?: string;
}>;

type Draft = {
  id: string | null;
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

function draftFrom(initial: PartialBriefInput | null | undefined): Draft {
  const b = initial ?? {};
  return {
    id: b.id ?? null,
    title: b.title ?? "",
    vertical: b.vertical ?? "",
    requiredSkills: b.requiredSkills ?? [],
    maximumTeamSize: b.maximumTeamSize != null ? String(b.maximumTeamSize) : "3",
    range:
      b.availabilityStart && b.availabilityEnd
        ? { from: fromIso(b.availabilityStart), to: fromIso(b.availabilityEnd) }
        : undefined,
    deliveryMode: b.deliveryMode ?? "",
    location: b.location ?? "",
    dailyBudget: b.dailyBudget != null ? String(b.dailyBudget) : "",
    preferReusableIp: b.preferReusableIp ?? false,
  };
}

function toInput(draft: Draft): unknown {
  return {
    id: draft.id ?? briefIdFor(draft.title),
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

/** Field order for "focus the first error on submit" (PRD §5.3 order, availability merged, location included). */
const FIELD_ORDER = [...new Set([...REQUIRED_FIELDS.map((f) => FIELD_ALIASES[f] ?? f), "location"])];
const FIELD_INPUT_ID: Record<string, string> = {
  title: "brief-title",
  vertical: "brief-vertical-0",
  requiredSkills: "brief-skill-0",
  maximumTeamSize: "brief-team-size",
  availability: "brief-availability",
  deliveryMode: "brief-mode-0",
  location: "brief-location",
  dailyBudget: "brief-budget",
};

/**
 * The venture brief as editable fields (screen 4 review and the screen 3 form fallback).
 * Re-validates with the VentureBrief Zod schema before submit; every error renders inline under
 * its field with id `error-<field>` so the input can point at it.
 */
export function BriefEditor({ initial, busy, serverError, onSubmit, onBack, backLabel = "Back to chat" }: BriefEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dismissedServerError, setDismissedServerError] = useState<string | null>(null);

  // A new `initial` remounts the editor through its `key` (see ReviewPage), so no effect here.
  const serverErrors = useMemo(() => {
    if (!serverError || serverError === dismissedServerError) return {};
    return Object.fromEntries(splitFieldMessages(serverError).map((item) => [item.field, item.text]));
  }, [serverError, dismissedServerError]);

  const errors: Record<string, string> = { ...serverErrors, ...clientErrors };

  const patch = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setClientErrors({});
    if (serverError) setDismissedServerError(serverError);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = VentureBrief.safeParse(toInput(draft));
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const raw = String(issue.path[0] ?? "form");
        const key = FIELD_ALIASES[raw] ?? raw;
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (draft.deliveryMode === "on-site" && !draft.location.trim()) {
      next.location = "Location is required for on-site delivery";
    }
    if (draft.range?.from && !draft.range.to) next.availability = "Pick an end date";
    if (Object.keys(next).length > 0 || !parsed.success) {
      setClientErrors(next);
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(FIELD_INPUT_ID[first] ?? "")?.focus();
      return;
    }
    setClientErrors({});
    onSubmit(parsed.data);
  }

  const describedBy = (field: string) => (errors[field] ? `error-${field}` : undefined);
  const invalid = (field: string) => (errors[field] ? true : undefined);
  const error = (field: string) =>
    errors[field] ? (
      <p id={`error-${field}`} role="alert" className="text-[13px] text-danger">
        {errors[field]}
      </p>
    ) : null;

  const pillClass = (selected: boolean) =>
    `inline-flex h-8 cursor-pointer items-center rounded-pill border px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/50 has-focus-visible:ring-offset-1 ${
      selected
        ? "border-accent-green bg-accent-green text-white"
        : "border-border-strong bg-surface-strong hover:border-accent-green"
    }`;

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
      {errors.form && (
        <p id="error-form" role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger md:col-span-2">
          {errors.form}
        </p>
      )}

      <div className="flex flex-col gap-1 md:col-span-2">
        <label htmlFor="brief-title" className="text-[13px] text-ink-2">
          Title
        </label>
        <input
          id="brief-title"
          name="title"
          autoComplete="off"
          value={draft.title}
          aria-invalid={invalid("title")}
          aria-describedby={describedBy("title")}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-10 rounded-card border border-border-strong bg-surface-strong px-3"
        />
        {error("title")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] text-ink-2">Vertical</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Vertical">
          {VERTICALS.map((vertical, index) => (
            <label key={vertical} className={pillClass(draft.vertical === vertical)}>
              <input
                id={`brief-vertical-${index}`}
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
          {SKILLS.map((skill, index) => {
            const checked = draft.requiredSkills.includes(skill);
            return (
              <label key={skill} className={pillClass(checked)}>
                <input
                  id={`brief-skill-${index}`}
                  name="requiredSkills"
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
          name="maximumTeamSize"
          inputMode="numeric"
          type="number"
          min={1}
          max={5}
          value={draft.maximumTeamSize}
          aria-invalid={invalid("maximumTeamSize")}
          aria-describedby={describedBy("maximumTeamSize")}
          onChange={(e) => patch({ maximumTeamSize: e.target.value })}
          className="h-10 w-24 rounded-card border border-border-strong bg-surface-strong px-3 font-mono"
        />
        {error("maximumTeamSize")}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="brief-availability" className="text-[13px] text-ink-2">
          Availability
        </label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              id="brief-availability"
              type="button"
              aria-invalid={invalid("availability")}
              aria-describedby={describedBy("availability")}
              className="flex h-10 items-center rounded-card border border-border-strong bg-surface-strong px-3 text-left font-mono text-sm"
            >
              {rangeLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft.range?.from ?? DEMO_MONTH}
              selected={draft.range}
              onSelect={(range) => patch({ range })}
            />
          </PopoverContent>
        </Popover>
        {error("availability")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] text-ink-2">Delivery mode</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Delivery mode">
          {MODES.map((mode, index) => (
            <label key={mode} className={pillClass(draft.deliveryMode === mode)}>
              <input
                id={`brief-mode-${index}`}
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
          name="location"
          autoComplete="off"
          value={draft.location}
          disabled={draft.deliveryMode !== "on-site"}
          aria-invalid={invalid("location")}
          aria-describedby={describedBy("location")}
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
        <div
          className={`flex h-10 items-center rounded-card border bg-surface-strong px-3 font-mono focus-within:border-accent-green focus-within:ring-2 focus-within:ring-ring/50 ${
            errors.dailyBudget ? "border-danger" : "border-border-strong"
          }`}
        >
          <span className="text-ink-3">USD</span>
          <input
            id="brief-budget"
            name="dailyBudget"
            inputMode="numeric"
            type="number"
            min={1}
            value={draft.dailyBudget}
            aria-invalid={invalid("dailyBudget")}
            aria-describedby={describedBy("dailyBudget")}
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
          name="preferReusableIp"
          type="checkbox"
          checked={draft.preferReusableIp}
          onChange={(e) => patch({ preferReusableIp: e.target.checked })}
          className="h-4 w-4 accent-accent-green"
        />
        <label htmlFor="brief-ip" className="text-sm">
          Prefer reusable IP
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 md:col-span-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Finding your route…" : "Find my route"}
        </Button>
      </div>
    </form>
  );
}
