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
  onChange(next: string[]): void;
  max?: number;
  errors?: Record<string, string>;
  errorField?: string;
}>;

export function SkillPicker({ id, label, value, onChange, max = 20, errors = {}, errorField = "skillSet" }: SkillPickerProps) {
  const [draft, setDraft] = useState("");
  const listId = `${id}-suggestions`;

  function addSkill() {
    const trimmed = draft.trim();
    if (!trimmed || value.length >= max) {
      setDraft("");
      return;
    }
    const exists = value.some((skill) => skill.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <span className="font-mono text-[11px] text-ink-3">
          {value.length} / {max}
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
        <Button type="button" variant="outline" size="sm" disabled={value.length >= max} onClick={addSkill}>
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
