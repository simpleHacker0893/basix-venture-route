/**
 * /profile/projects/new (screen 9, Stitch batch-3/add-project, D-36): title, vertical, one to five
 * skills demonstrated, completion date, licensable toggle, submit for confirmation. The project is
 * a pending row until a BASIX admin confirms it; only then is it projected as graph facts.
 */
import { ProjectInput, type SkillId } from "@venture-route/contracts";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { ApiNotFoundError, ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILLS, SKILL_LABELS, VERTICALS, VERTICAL_LABELS } from "../../lib/brief";
import { PROJECT_FIELDS, splitFieldMessages } from "../../lib/validationError";
import { errorMessage, helpClass, inputClass, labelClass, pillClass } from "./formStyles";
import { Card, FieldError, Toggle } from "./StatusPill";

const MAX_SKILLS = 5;

const NEXT_STEPS: { step: string; body: string }[] = [
  { step: "Submitted", body: "Your project is stored as a pending row on your profile." },
  { step: "Admin review", body: "A BASIX admin checks the project against the skills it claims to demonstrate." },
  { step: "Live in graph", body: "Confirmed projects are projected as facts the MeTTa rules reason over (verified-for-skill, reuse-fit)." },
];

export function AddProjectPage() {
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("");
  const [skillIds, setSkillIds] = useState<SkillId[]>([]);
  const [completedOn, setCompletedOn] = useState("");
  const [licensable, setLicensable] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const clearErrors = () => setErrors({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = ProjectInput.safeParse({
      title: title.trim(),
      vertical: vertical || undefined,
      licensable,
      completedOn: completedOn || undefined,
      skillIds,
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
      await api.postProject(parsed.data);
      navigate("/profile");
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        setErrors(Object.fromEntries(splitFieldMessages(cause.message, PROJECT_FIELDS, {}).map((m) => [m.field, m.text])));
      } else if (cause instanceof ApiNotFoundError) {
        setErrors({ form: "Save your profile first, then add projects." });
      } else {
        setErrors({ form: errorMessage(cause, "The project could not be submitted.") });
      }
      setBusy(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `error-${field}` : undefined);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-12">
      <Link to="/profile" className="w-fit text-sm text-ink-2 underline-offset-4 hover:text-accent-green hover:underline">
        ← Back to builder profile
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Builder draft</span>
            <DemoDataPill />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">Add a showcase project</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Projects become facts the graph reasons over once a BASIX admin confirms them.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          aria-label="Add a showcase project"
          onSubmit={(e) => void submit(e)}
          noValidate
          className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6 lg:col-span-2"
        >
          {errors.form ? (
            <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
              {errors.form}
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor="project-title" className={labelClass}>
              Project title
            </label>
            <input
              id="project-title"
              autoComplete="off"
              maxLength={120}
              placeholder="e.g. Clinic triage intake flow"
              value={title}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describedBy("title") ?? "project-title-help"}
              onChange={(e) => {
                setTitle(e.target.value);
                clearErrors();
              }}
              className={inputClass}
            />
            <span id="project-title-help" className={helpClass}>
              A clear noun phrase naming the system or artifact.
            </span>
            <FieldError field="title" errors={errors} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>Vertical</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vertical" aria-describedby={describedBy("vertical")}>
              {VERTICALS.map((option) => (
                <label key={option} className={pillClass(vertical === option)}>
                  <input
                    type="radio"
                    name="vertical"
                    value={option}
                    checked={vertical === option}
                    onChange={() => {
                      setVertical(option);
                      clearErrors();
                    }}
                    className="sr-only"
                  />
                  {VERTICAL_LABELS[option]}
                </label>
              ))}
            </div>
            <FieldError field="vertical" errors={errors} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>Skills demonstrated</legend>
            <span className={helpClass}>
              One to five skills. A BASIX admin checks each one against the project before it enters the graph.
            </span>
            <div className="flex flex-wrap gap-2" aria-describedby={describedBy("skillIds")}>
              {SKILLS.map((skill) => {
                const checked = skillIds.includes(skill);
                const full = !checked && skillIds.length >= MAX_SKILLS;
                return (
                  <label key={skill} className={pillClass(checked)}>
                    <input
                      type="checkbox"
                      name="skillIds"
                      checked={checked}
                      disabled={full}
                      onChange={() => {
                        setSkillIds(checked ? skillIds.filter((s) => s !== skill) : [...skillIds, skill]);
                        clearErrors();
                      }}
                      className="sr-only"
                    />
                    {SKILL_LABELS[skill]}
                  </label>
                );
              })}
            </div>
            <FieldError field="skillIds" errors={errors} />
          </fieldset>

          <Toggle
            id="project-licensable"
            label="Licensable as reusable IP"
            checked={licensable}
            onChange={(next) => {
              setLicensable(next);
              clearErrors();
            }}
            description="Founders who prefer reusable IP may be routed to this asset when it fits their brief (reuse-fit rule)."
          />
          <FieldError field="licensable" errors={errors} />

          <div className="flex flex-col gap-1">
            <label htmlFor="project-completed-on" className={labelClass}>
              Completion date
            </label>
            <input
              id="project-completed-on"
              type="date"
              value={completedOn}
              aria-invalid={errors.completedOn ? true : undefined}
              aria-describedby={describedBy("completedOn") ?? "project-completed-help"}
              onChange={(e) => {
                setCompletedOn(e.target.value);
                clearErrors();
              }}
              className={`${inputClass} w-fit font-mono`}
            />
            <span id="project-completed-help" className={helpClass}>
              Date only (Africa/Nairobi); a completed project is what the rules count as proof.
            </span>
            <FieldError field="completedOn" errors={errors} />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate("/profile")}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Submitting…" : "Submit for confirmation"}
            </Button>
          </div>
        </form>

        <Card title="What happens next" eyebrow="Graph assurance">
          <ol className="flex flex-col gap-3">
            {NEXT_STEPS.map((item, index) => (
              <li key={item.step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-green font-mono text-[11px] text-white">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">{item.step}</span>
                  <span className="text-[12px] leading-relaxed text-ink-3">{item.body}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className={helpClass}>Only confirmed rows are projected into the graph; a rejected project leaves it on the next reprojection.</p>
        </Card>
      </div>
    </div>
  );
}
