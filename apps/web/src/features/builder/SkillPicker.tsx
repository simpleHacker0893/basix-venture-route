/**
 * A combobox for the builder's free-text skill set (Stitch batch-3/builder-profile, spec #86
 * stories 17-19): the nine vocabulary display names as suggestions plus free text, removable
 * chips, an "N / max" counter, and case-insensitive duplicates silently ignored. Always labelled
 * "Self-described" — this component never decides, and never claims, "verified" (AGENTS.md
 * non-negotiable 4; D-52 projects these labels as display-only facts no rule reads).
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SKILLS, SKILL_LABELS } from "../../lib/brief";
import { helpClass, labelClass } from "./formStyles";
import { FieldError } from "./StatusPill";

type SkillPickerProps = Readonly<{
  id: string;
  label: string;
  value: readonly string[];
  /**
   * The other free-text list sharing the same combined limit (spec #86, D-40, D-52): the engine
   * rejects a label already present in either `skillSet` or `suggestedSkills`, case-insensitively
   * (`schemas.py` combined-uniqueness check), so this picker must too — never just against
   * `value` — or a chip that is valid here still 422s on save.
   */
  otherValues?: readonly string[];
  onChange(next: string[]): void;
  /** The combined cap across `value` and `otherValues` (20, D-40), not just this list's length. */
  max?: number;
  errors?: Record<string, string>;
  errorField?: string;
}>;

export function SkillPicker({
  id,
  label,
  value,
  otherValues = [],
  onChange,
  max = 20,
  errors = {},
  errorField = "skillSet",
}: SkillPickerProps) {
  const [draft, setDraft] = useState("");
  const listId = `${id}-suggestions`;
  const combined = [...value, ...otherValues];
  const atCap = combined.length >= max;

  function addSkill() {
    const trimmed = draft.trim();
    if (!trimmed || atCap) {
      setDraft("");
      return;
    }
    const exists = combined.some((skill) => skill.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
          <span className="inline-flex h-5 items-center rounded-pill border border-border-strong bg-surface-strong px-2 text-[11px] text-ink-3">
            Self-described
          </span>
        </div>
        <span className="font-mono text-[11px] text-ink-3">
          {combined.length} / {max}
        </span>
      </div>
      <span className={helpClass}>Self-described. Shown on your public Showcase profile; never counted as verified.</span>
      <div className="flex gap-2">
        <input
          id={id}
          list={listId}
          autoComplete="off"
          maxLength={40}
          value={draft}
          aria-invalid={errors[errorField] ? true : undefined}
          aria-describedby={errors[errorField] ? `error-${errorField}` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSkill();
            }
          }}
          className="h-10 flex-1 rounded-card border border-border-strong bg-surface-strong px-3 text-sm focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <datalist id={listId}>
          {SKILLS.map((skill) => (
            <option key={skill} value={SKILL_LABELS[skill]} />
          ))}
        </datalist>
        <Button type="button" variant="outline" size="sm" disabled={atCap} onClick={addSkill}>
          Add skill
        </Button>
      </div>
      {value.length > 0 ? (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {value.map((skill) => (
            <li
              key={skill}
              className="inline-flex h-8 items-center gap-2 rounded-pill border border-border-strong bg-surface-strong px-3 text-sm"
            >
              <span>{skill}</span>
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() => onChange(value.filter((s) => s !== skill))}
                className="text-ink-3 hover:text-danger"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError field={errorField} errors={errors} />
    </div>
  );
}
