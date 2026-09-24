/**
 * Per-project Showcase editor (Stitch batch-3/add-project layout, spec #86 stories 1-13): the
 * builder's own description, Live/Demo/YouTube pitch/Pitch deck links and the "Show on Showcase"
 * switch, with the entry's own status pill and the pending note. Every save goes back to
 * `pending` (or `none` when switched off) — the engine decides that, this form only sends the
 * fields and renders whatever status it answers (AGENTS.md non-negotiable 4).
 */
import { ShowcaseEdit, type ShowcaseEditInput, type ShowcaseProject } from "@venture-route/contracts";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ApiValidationError } from "../../api/client";
import { SHOWCASE_FIELDS, splitFieldMessages } from "../../lib/validationError";
import { errorMessage, helpClass, inputClass, labelClass } from "./formStyles";
import { FieldError, Toggle } from "./StatusPill";

const DESCRIPTION_MAX = 1000;

type ShowcaseEditorProps = Readonly<{
  project: ShowcaseProject;
  onSave(projectId: string, body: ShowcaseEditInput): Promise<ShowcaseProject>;
}>;

function draftFrom(project: ShowcaseProject) {
  return {
    description: project.description,
    liveUrl: project.liveUrl ?? "",
    demoUrl: project.demoUrl ?? "",
    pitchVideoUrl: project.pitchVideoUrl ?? "",
    pitchDeckUrl: project.pitchDeckUrl ?? "",
    showcased: project.showcased,
  };
}

export function ShowcaseEditor({ project, onSave }: ShowcaseEditorProps) {
  const [draft, setDraft] = useState(() => draftFrom(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (changes: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setErrors({});
    setSaved(false);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = ShowcaseEdit.safeParse({
      description: draft.description,
      liveUrl: draft.liveUrl.trim() || null,
      demoUrl: draft.demoUrl.trim() || null,
      pitchVideoUrl: draft.pitchVideoUrl.trim() || null,
      pitchDeckUrl: draft.pitchDeckUrl.trim() || null,
      showcased: draft.showcased,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const updated = await onSave(project.id, parsed.data);
      setDraft(draftFrom(updated));
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        setErrors(Object.fromEntries(splitFieldMessages(cause.message, SHOWCASE_FIELDS, {}).map((m) => [m.field, m.text])));
      } else {
        setErrors({ form: errorMessage(cause, "Showcase details could not be saved.") });
      }
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `error-${field}` : undefined);

  return (
    <form
      id={`showcase-editor-${project.id}`}
      aria-label={`Showcase details for ${project.title}`}
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-4"
    >
      {errors.form ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface px-3 py-2 text-[13px] text-danger">
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor={`showcase-description-${project.id}`} className={labelClass}>
            Description
          </label>
          <span className="font-mono text-[11px] text-ink-3">
            {draft.description.length} / {DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id={`showcase-description-${project.id}`}
          rows={4}
          maxLength={DESCRIPTION_MAX}
          value={draft.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy("description")}
          onChange={(e) => patch({ description: e.target.value })}
          className="rounded-card border border-border-strong bg-surface px-3 py-2 text-sm focus:border-accent-green focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <FieldError field="description" errors={errors} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`showcase-live-url-${project.id}`} className={labelClass}>
            Live URL
          </label>
          <input
            id={`showcase-live-url-${project.id}`}
            autoComplete="off"
            maxLength={500}
            value={draft.liveUrl}
            aria-invalid={errors.liveUrl ? true : undefined}
            aria-describedby={describedBy("liveUrl")}
            onChange={(e) => patch({ liveUrl: e.target.value })}
            className={inputClass}
          />
          <FieldError field="liveUrl" errors={errors} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`showcase-demo-url-${project.id}`} className={labelClass}>
            Demo URL
          </label>
          <input
            id={`showcase-demo-url-${project.id}`}
            autoComplete="off"
            maxLength={500}
            value={draft.demoUrl}
            aria-invalid={errors.demoUrl ? true : undefined}
            aria-describedby={describedBy("demoUrl")}
            onChange={(e) => patch({ demoUrl: e.target.value })}
            className={inputClass}
          />
          <FieldError field="demoUrl" errors={errors} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`showcase-pitch-video-${project.id}`} className={labelClass}>
            YouTube pitch link
          </label>
          <input
            id={`showcase-pitch-video-${project.id}`}
            autoComplete="off"
            maxLength={500}
            value={draft.pitchVideoUrl}
            aria-invalid={errors.pitchVideoUrl ? true : undefined}
            aria-describedby={describedBy("pitchVideoUrl")}
            onChange={(e) => patch({ pitchVideoUrl: e.target.value })}
            className={inputClass}
          />
          <FieldError field="pitchVideoUrl" errors={errors} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`showcase-pitch-deck-${project.id}`} className={labelClass}>
            Pitch deck URL
          </label>
          <input
            id={`showcase-pitch-deck-${project.id}`}
            autoComplete="off"
            maxLength={500}
            value={draft.pitchDeckUrl}
            aria-invalid={errors.pitchDeckUrl ? true : undefined}
            aria-describedby={describedBy("pitchDeckUrl")}
            onChange={(e) => patch({ pitchDeckUrl: e.target.value })}
            className={inputClass}
          />
          <FieldError field="pitchDeckUrl" errors={errors} />
        </div>
      </div>

      <Toggle
        id={`showcase-toggle-${project.id}`}
        label="Show on Showcase"
        checked={draft.showcased}
        onChange={(showcased) => patch({ showcased })}
        description="Submitted for public listing once an admin confirms it; switching off removes it at once."
      />
      <FieldError field="showcased" errors={errors} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" className="w-fit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save showcase details"}
        </Button>
        {saved ? (
          <p role="status" className="text-[13px] font-medium text-accent-green">
            Showcase details saved.
          </p>
        ) : null}
      </div>
      <p className={helpClass}>Any change sends this entry back for review; identical values leave a live entry unchanged.</p>
    </form>
  );
}
