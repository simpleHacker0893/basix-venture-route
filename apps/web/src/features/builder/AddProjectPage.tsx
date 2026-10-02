/**
 * /profile/projects/new (screen 9, Stitch batch-3/add-project, D-36): title, vertical, one to five
 * skills demonstrated, completion date, licensable toggle, submit for confirmation. The project is
 * a pending row until a BASIX admin confirms it; only then is it projected as graph facts.
 */
import { ProjectInput, ShowcaseEdit, type SkillId } from "@venture-route/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import type { AccountStatus } from "@venture-route/contracts";
import { ApiNotFoundError, ApiValidationError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILLS, SKILL_LABELS, VERTICALS, VERTICAL_LABELS } from "../../lib/brief";
import { PROJECT_FIELDS, splitFieldMessages } from "../../lib/validationError";
import { errorMessage, helpClass, inputClass, labelClass, pillClass } from "./formStyles";
import { Card, FieldError, Toggle } from "./StatusPill";

const MAX_SKILLS = 5;
const LINK_HELP = "Optional. Add a link so people can see your work. You can change it later in My showcase.";
const SHOWCASE_HELP =
  "Sends this project to BASIX for review. It goes public once your account and the project are both confirmed. Leave it off to keep it private for now.";
/** Shown on the profile when the project was created but its link could not be saved. */
export const LINK_SAVE_FAILED = "Project saved. We couldn't save the link. Add it from My showcase.";

const NEXT_STEPS: { step: string; body: string }[] = [
  { step: "Project saved", body: "It appears in My showcase as a draft, visible only to you." },
  { step: "You publish it", body: "Turn on Show on Showcase when you are ready." },
  { step: "BASIX reviews", body: "Once confirmed, it goes live on the public Showcase." },
];

export function AddProjectPage() {
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("");
  const [skillIds, setSkillIds] = useState<SkillId[]>([]);
  const [completedOn, setCompletedOn] = useState("");
  const [licensable, setLicensable] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [showcased, setShowcased] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // The builder's own account status, for the "still in review" note beside the form.
  const [account, setAccount] = useState<AccountStatus | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then((profile) => (cancelled ? undefined : setAccount(profile.accountStatus)))
      .catch(() => (cancelled ? undefined : setAccount(null)));
    return () => {
      cancelled = true;
    };
  }, [api]);

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
    // The same schema and field rules as ShowcaseEditor, checked before anything is created.
    const link = ShowcaseEdit.safeParse({
      liveUrl: liveUrl.trim() || null,
      demoUrl: demoUrl.trim() || null,
      showcased,
    });
    if (!link.success) {
      const next: Record<string, string> = {};
      for (const issue of link.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const created = await api.postProject(parsed.data);
      let notice: string | undefined;
      if (link.data.liveUrl !== null || link.data.demoUrl !== null || link.data.showcased) {
        try {
          await api.saveShowcase(created.id, link.data);
        } catch {
          notice = LINK_SAVE_FAILED;
        }
      }
      navigate("/my-showcase", { state: notice ? { notice } : undefined });
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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/my-showcase"
        className="inline-flex min-h-11 w-fit items-center text-sm text-ink-2 underline-offset-4 hover:text-accent-green hover:underline sm:min-h-0"
      >
        ← My showcase
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
          className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 sm:p-6 lg:col-span-2"
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

          <fieldset className="flex flex-col gap-4 border-t border-border pt-6">
            <legend className="font-display text-xl font-semibold text-ink">Show your work</legend>
            <span id="project-links-help" className={helpClass}>
              {LINK_HELP}
            </span>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="project-live-url" className={labelClass}>
                  Project link
                </label>
                <input
                  id="project-live-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  maxLength={500}
                  placeholder="https://… live site or GitHub repo"
                  value={liveUrl}
                  aria-invalid={errors.liveUrl ? true : undefined}
                  aria-describedby={describedBy("liveUrl") ?? "project-links-help"}
                  onChange={(e) => {
                    setLiveUrl(e.target.value);
                    clearErrors();
                  }}
                  className={inputClass}
                />
                <FieldError field="liveUrl" errors={errors} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="project-demo-url" className={labelClass}>
                  Demo link
                </label>
                <input
                  id="project-demo-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  maxLength={500}
                  placeholder="https://… video or walkthrough"
                  value={demoUrl}
                  aria-invalid={errors.demoUrl ? true : undefined}
                  aria-describedby={describedBy("demoUrl") ?? "project-links-help"}
                  onChange={(e) => {
                    setDemoUrl(e.target.value);
                    clearErrors();
                  }}
                  className={inputClass}
                />
                <FieldError field="demoUrl" errors={errors} />
              </div>
            </div>
            <label
              htmlFor="project-showcased"
              className="flex cursor-pointer items-start gap-3 rounded-card border border-accent-green/30 bg-credential-tint/60 p-4"
            >
              <input
                id="project-showcased"
                type="checkbox"
                checked={showcased}
                aria-labelledby="project-showcased-label"
                aria-describedby="project-showcased-help"
                onChange={(e) => {
                  setShowcased(e.target.checked);
                  clearErrors();
                }}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent-green"
              />
              <span className="flex flex-col gap-1">
                <span id="project-showcased-label" className="text-sm font-semibold text-ink">
                  Show on Showcase
                </span>
                <span id="project-showcased-help" className="text-[13px] leading-relaxed text-ink-2">
                  {SHOWCASE_HELP}
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" size="lg" className="w-full sm:h-10 sm:w-auto" onClick={() => navigate("/my-showcase")}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="w-full sm:h-10 sm:w-auto" disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : "Save project"}
            </Button>
          </div>
        </form>

        {/* The side panel is for wide screens only; the form carries the same guidance in its helper text. */}
        <aside className="hidden lg:block">
          <Card title="What happens next">
            <ol className="flex flex-col gap-4">
              {NEXT_STEPS.map((item, index) => (
                <li key={item.step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-credential-tint font-mono text-[11px] font-semibold text-accent-green">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-ink">{item.step}</span>
                    <span className="text-[12px] leading-relaxed text-ink-3">{item.body}</span>
                  </div>
                </li>
              ))}
            </ol>
            {account !== undefined && account !== "confirmed" ? (
              <p role="status" className="rounded-card bg-amber-fill/70 px-3.5 py-3 text-[13px] leading-relaxed text-amber-ink">
                Your account is still in review. You can save projects now. They stay private until BASIX confirms you.
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
