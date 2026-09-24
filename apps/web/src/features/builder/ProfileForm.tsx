/**
 * The builder profile form (Stitch batch-3/builder-profile, D-36): about you, skills, availability
 * with the same Calendar range picker as the brief editor, delivery modes and location, account
 * status, the three contact-sharing toggles and Save. The engine decides every skill's status and
 * evidence (AGENTS.md non-negotiable 4); this form only renders `profile.skills`.
 */
import {
  ProfileInput,
  type AvailabilityRange,
  type BuilderProfile,
  type ContactSharing,
  type DeliveryModes,
  type ProfileInput as ProfileInputT,
  type SkillId,
} from "@venture-route/contracts";
import { useState, type FormEvent } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ApiValidationError } from "../../api/client";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILLS, SKILL_LABELS } from "../../lib/brief";
import { DEMO_MONTH, iso } from "../../lib/dates";
import { dateRange } from "../../lib/format";
import { PROFILE_FIELDS, splitFieldMessages } from "../../lib/validationError";
import { EvidenceBadge } from "../route/Badges";
import { errorMessage, helpClass, inputClass, labelClass, pillClass } from "./formStyles";
import { ResumeSuggestions } from "./ResumeSuggestions";
import { SkillPicker } from "./SkillPicker";
import { Card, FieldError, Toggle } from "./StatusPill";

/** Skill set + résumé suggestions combined, ≤20 entries of ≤40 characters (D-40, spec #86). */
const SKILL_SET_LIMIT = 20;

type ProfileFormProps = Readonly<{
  /** `null` before the first save (GET /api/me/profile answered 404): the form starts empty. */
  profile: BuilderProfile | null;
  onSave(input: ProfileInputT): Promise<void>;
}>;

type Draft = {
  displayName: string;
  headline: string;
  cohortId: string;
  location: string;
  dayRate: string;
  modes: DeliveryModes;
  selfDescribedSkills: SkillId[];
  phone: string;
  linkedin: string;
  sharing: ContactSharing;
  /** Windows already added; the calendar selection below is appended on save. */
  windows: AvailabilityRange[];
  range: DateRange | undefined;
  /** Sprint 005a (spec #86, D-52): free-text skill chips picked by hand vs. accepted from a résumé. */
  skillSet: string[];
  suggestedSkills: string[];
  githubUrl: string;
  linkedinUrl: string;
};

/** Cohort ids from services/engine/seed/facts.metta; the field stays free text (any ≤40-char id). */
const SEED_COHORTS = ["cohort-2026a", "cohort-2026b", "cohort-2025c"] as const;

const MODE_FIELDS: { key: keyof DeliveryModes; label: string }[] = [
  { key: "remote", label: "Remote" },
  { key: "hybrid", label: "Hybrid" },
  { key: "onSite", label: "On-site" },
];

function draftFrom(profile: BuilderProfile | null): Draft {
  return {
    displayName: profile?.displayName ?? "",
    headline: profile?.headline ?? "",
    cohortId: profile?.cohortId ?? "",
    location: profile?.location ?? "",
    dayRate: profile ? String(profile.dayRate) : "",
    modes: profile?.modes ?? { remote: false, hybrid: false, onSite: false },
    selfDescribedSkills: profile?.selfDescribedSkills ?? [],
    phone: profile?.contact.phone ?? "",
    linkedin: profile?.contact.linkedin ?? "",
    sharing: profile?.sharing ?? { email: false, phone: false, linkedin: false },
    windows: profile?.availability ?? [],
    range: undefined,
    skillSet: profile?.skillSet ?? [],
    suggestedSkills: profile?.suggestedSkills ?? [],
    githubUrl: profile?.githubUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
  };
}

function currentWindow(range: DateRange | undefined): AvailabilityRange | null {
  return range?.from && range.to ? { start: iso(range.from), end: iso(range.to) } : null;
}

function toInput(draft: Draft): unknown {
  const picked = currentWindow(draft.range);
  return {
    displayName: draft.displayName.trim(),
    headline: draft.headline.trim(),
    cohortId: draft.cohortId.trim() || null,
    location: draft.location.trim(),
    dayRate: draft.dayRate === "" ? undefined : Number(draft.dayRate),
    modes: draft.modes,
    selfDescribedSkills: draft.selfDescribedSkills,
    phone: draft.phone.trim() || null,
    linkedin: draft.linkedin.trim() || null,
    sharing: draft.sharing,
    availability: picked ? [...draft.windows, picked] : draft.windows,
    skillSet: draft.skillSet,
    suggestedSkills: draft.suggestedSkills,
    githubUrl: draft.githubUrl.trim() || null,
    linkedinUrl: draft.linkedinUrl.trim() || null,
  };
}

const ACCOUNT_LINE: Record<BuilderProfile["accountStatus"], string> = {
  pending: "Awaiting BASIX admin review",
  confirmed: "Confirmed by BASIX admin",
  rejected: "Rejected by BASIX admin",
};

export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setErrors({});
    setSaved(false);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = ProfileInput.safeParse(toInput(draft));
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (!draft.modes.remote && !draft.modes.hybrid && !draft.modes.onSite) next.modes = "Pick at least one delivery mode";
    if (draft.range?.from && !draft.range.to) next.availability = "Pick an end date";
    if (!parsed.success || Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await onSave(parsed.data);
      const picked = currentWindow(draft.range);
      setDraft((current) => ({ ...current, windows: picked ? [...current.windows, picked] : current.windows, range: undefined }));
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        setErrors(Object.fromEntries(splitFieldMessages(cause.message, PROFILE_FIELDS, {}).map((m) => [m.field, m.text])));
      } else {
        setErrors({ form: errorMessage(cause, "The profile could not be saved.") });
      }
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `error-${field}` : undefined);
  const invalid = (field: string) => (errors[field] ? true : undefined);

  const picked = currentWindow(draft.range);
  const rangeLabel = picked
    ? dateRange(picked.start, picked.end)
    : draft.range?.from
      ? `${iso(draft.range.from)} – …`
      : "Pick a start and end date";

  return (
    <form aria-label="Builder profile" onSubmit={(e) => void submit(e)} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {errors.form ? (
          <p id="error-form" role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
            {errors.form}
          </p>
        ) : null}

        <Card title="About you" lead="The name and headline founders see on a route and in candidate lists.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="profile-display-name" className={labelClass}>
                Display name
              </label>
              <input
                id="profile-display-name"
                autoComplete="name"
                value={draft.displayName}
                aria-invalid={invalid("displayName")}
                aria-describedby={describedBy("displayName")}
                onChange={(e) => patch({ displayName: e.target.value })}
                className={inputClass}
              />
              <FieldError field="displayName" errors={errors} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="profile-headline" className={labelClass}>
                Headline
              </label>
              <input
                id="profile-headline"
                autoComplete="off"
                maxLength={200}
                value={draft.headline}
                aria-invalid={invalid("headline")}
                aria-describedby={describedBy("headline")}
                onChange={(e) => patch({ headline: e.target.value })}
                className={inputClass}
              />
              <FieldError field="headline" errors={errors} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-cohort" className={labelClass}>
                Cohort
              </label>
              <input
                id="profile-cohort"
                list="profile-cohort-ids"
                autoComplete="off"
                maxLength={40}
                value={draft.cohortId}
                aria-invalid={invalid("cohortId")}
                aria-describedby={describedBy("cohortId") ?? "profile-cohort-help"}
                onChange={(e) => patch({ cohortId: e.target.value })}
                className={`${inputClass} font-mono`}
              />
              <datalist id="profile-cohort-ids">
                {SEED_COHORTS.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
              <span id="profile-cohort-help" className={helpClass}>
                Optional. The cohort id links you to a university and its partners (partner-fit rule).
              </span>
              <FieldError field="cohortId" errors={errors} />
            </div>
          </div>
        </Card>

        <Card
          title="Skills"
          lead="Verified only when a confirmed credential or project proves the skill; the engine decides, the profile only shows it."
          aside={
            profile ? (
              <span className="font-mono text-[11px] text-ink-3">
                {profile.skills.filter((s) => s.status === "verified").length} verified ·{" "}
                {profile.skills.filter((s) => s.status === "self-described").length} self-described
              </span>
            ) : null
          }
        >
          {profile && profile.skills.length > 0 ? (
            <ul aria-label="Skills" className="flex flex-col divide-y divide-border">
              {profile.skills.map((skill) => (
                <li key={skill.id} aria-label={skill.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-ink">{skill.name}</span>
                    {skill.status === "verified" ? (
                      <span className="text-[12px] text-ink-3">Verified · counts toward eligible-builder</span>
                    ) : (
                      <span className="text-[12px] text-ink-3">Self-described · display only</span>
                    )}
                  </div>
                  {skill.status === "verified" && skill.evidence ? (
                    <EvidenceBadge evidence={skill.evidence} />
                  ) : (
                    <span className="inline-flex h-6 items-center rounded-pill border border-border-strong px-2.5 text-[12px] text-ink-3">
                      Not used for routing
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">
              No skills on record yet. Tick the skills you describe yourself with, then add a credential or a project as proof.
            </p>
          )}
          <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
            <legend className="sr-only">Self-described skills</legend>
            <span className={labelClass}>Self-described skills</span>
            <span className={helpClass}>Shown on your profile as display only. They never satisfy verified-for-skill.</span>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => {
                const checked = draft.selfDescribedSkills.includes(skill);
                return (
                  <label key={skill} className={pillClass(checked)}>
                    <input
                      type="checkbox"
                      name="selfDescribedSkills"
                      checked={checked}
                      onChange={() =>
                        patch({
                          selfDescribedSkills: checked
                            ? draft.selfDescribedSkills.filter((s) => s !== skill)
                            : [...draft.selfDescribedSkills, skill],
                        })
                      }
                      className="sr-only"
                    />
                    {SKILL_LABELS[skill]}
                  </label>
                );
              })}
            </div>
            <FieldError field="selfDescribedSkills" errors={errors} />
          </fieldset>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <SkillPicker
              id="profile-skill-set"
              label="Skill set"
              value={draft.skillSet}
              max={SKILL_SET_LIMIT - draft.suggestedSkills.length}
              onChange={(skillSet) => patch({ skillSet })}
              errors={errors}
              errorField="skillSet"
            />
            <ResumeSuggestions
              onAccept={(label) => {
                const combined = [...draft.skillSet, ...draft.suggestedSkills];
                const exists = combined.some((skill) => skill.toLowerCase() === label.toLowerCase());
                if (exists || combined.length >= SKILL_SET_LIMIT) return;
                patch({ suggestedSkills: [...draft.suggestedSkills, label] });
              }}
            />
            {draft.suggestedSkills.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>Self-described</span>
                <ul aria-label="Suggested skills" className="flex flex-wrap gap-2">
                  {draft.suggestedSkills.map((skill) => (
                    <li
                      key={skill}
                      className="inline-flex h-8 items-center gap-2 rounded-pill border border-border-strong bg-surface-strong px-3 text-sm"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${skill}`}
                        onClick={() => patch({ suggestedSkills: draft.suggestedSkills.filter((s) => s !== skill) })}
                        className="text-ink-3 hover:text-danger"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <FieldError field="suggestedSkills" errors={errors} />
          </div>
        </Card>

        <Card title="Availability" lead="Pick the windows founders can book you for and your day rate. The available-for-brief rule needs the window to overlap a brief by at least two days.">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[13px] text-ink-2">
              <span className="text-ink-3">Selected window:</span> {rangeLabel}
            </p>
            <div
              aria-invalid={invalid("availability")}
              aria-describedby={describedBy("availability")}
              className={`w-fit rounded-card border bg-surface-strong ${errors.availability ? "border-danger" : "border-border"}`}
            >
              <Calendar
                mode="range"
                numberOfMonths={2}
                defaultMonth={draft.range?.from ?? DEMO_MONTH}
                selected={draft.range}
                onSelect={(range) => patch({ range })}
              />
            </div>
            <FieldError field="availability" errors={errors} />
            {draft.windows.length > 0 ? (
              <ul aria-label="Availability windows" className="flex flex-col gap-2">
                {draft.windows.map((window, index) => (
                  <li key={`${window.start}-${window.end}-${index}`} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-strong px-3 py-2">
                    <span className="font-mono text-[13px]">{dateRange(window.start, window.end)}</span>
                    <button
                      type="button"
                      onClick={() => patch({ windows: draft.windows.filter((_, i) => i !== index) })}
                      className="text-[13px] text-ink-3 underline hover:text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={!picked || draft.windows.length >= 12}
              onClick={() => (picked ? patch({ windows: [...draft.windows, picked], range: undefined }) : undefined)}
            >
              Add another window
            </Button>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-4">
            <label htmlFor="profile-day-rate" className={labelClass}>
              Day rate
            </label>
            <div
              className={`flex h-10 w-fit items-center rounded-card border bg-surface-strong px-3 font-mono focus-within:border-accent-green focus-within:ring-2 focus-within:ring-ring/50 ${
                errors.dayRate ? "border-danger" : "border-border-strong"
              }`}
            >
              <span className="text-ink-3">USD</span>
              <input
                id="profile-day-rate"
                inputMode="numeric"
                type="number"
                min={1}
                value={draft.dayRate}
                aria-invalid={invalid("dayRate")}
                aria-describedby={describedBy("dayRate") ?? "profile-day-rate-help"}
                onChange={(e) => patch({ dayRate: e.target.value })}
                className="w-24 bg-transparent px-2 focus:outline-none"
              />
              <span className="text-ink-3">/ day</span>
            </div>
            <span id="profile-day-rate-help" className={helpClass}>
              Compared with the founder's daily budget by the assembler's budget-fit rule.
            </span>
            <FieldError field="dayRate" errors={errors} />
          </div>
        </Card>

        <Card title="Delivery modes & location" lead="Checked by the mode-compatible rule against each brief's delivery mode.">
          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>Accepted engagement models</legend>
            <div className="flex flex-wrap gap-2" aria-describedby={describedBy("modes")}>
              {MODE_FIELDS.map(({ key, label }) => {
                const checked = draft.modes[key];
                return (
                  <label key={key} className={pillClass(checked)}>
                    <input
                      type="checkbox"
                      name={`modes.${key}`}
                      checked={checked}
                      onChange={() => patch({ modes: { ...draft.modes, [key]: !checked } })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <FieldError field="modes" errors={errors} />
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-location" className={labelClass}>
              Primary location / base
            </label>
            <input
              id="profile-location"
              autoComplete="address-level2"
              maxLength={100}
              value={draft.location}
              aria-invalid={invalid("location")}
              aria-describedby={describedBy("location") ?? "profile-location-help"}
              onChange={(e) => patch({ location: e.target.value })}
              className={inputClass}
            />
            <span id="profile-location-help" className={helpClass}>
              Matched against the brief location when the work is on-site.
            </span>
            <FieldError field="location" errors={errors} />
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card title="Account status" aside={<DemoDataPill />}>
          <p className="text-sm font-medium text-ink">
            {profile ? ACCOUNT_LINE[profile.accountStatus] : "Not submitted yet — save your profile to enter the review queue"}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px] text-ink-2">
            <dt className="text-ink-3">Cohort</dt>
            <dd>{draft.cohortId.trim() || "none"}</dd>
            {profile ? (
              <>
                <dt className="text-ink-3">Builder ID</dt>
                <dd translate="no">{profile.builderId}</dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card title="Public profile links" lead="Shown on your Showcase profile even when contact sharing is off (spec #86 stories 27-28).">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-github-url" className={labelClass}>
                GitHub profile
              </label>
              <input
                id="profile-github-url"
                autoComplete="url"
                placeholder="https://github.com/…"
                maxLength={500}
                value={draft.githubUrl}
                aria-invalid={invalid("githubUrl")}
                aria-describedby={describedBy("githubUrl")}
                onChange={(e) => patch({ githubUrl: e.target.value })}
                className={inputClass}
              />
              <FieldError field="githubUrl" errors={errors} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-linkedin-url" className={labelClass}>
                LinkedIn profile
              </label>
              <input
                id="profile-linkedin-url"
                autoComplete="url"
                placeholder="https://www.linkedin.com/in/…"
                maxLength={500}
                value={draft.linkedinUrl}
                aria-invalid={invalid("linkedinUrl")}
                aria-describedby={describedBy("linkedinUrl")}
                onChange={(e) => patch({ linkedinUrl: e.target.value })}
                className={inputClass}
              />
              <FieldError field="linkedinUrl" errors={errors} />
            </div>
          </div>
        </Card>

        <Card title="Contact sharing" lead="Founders only see what you switch on.">
          <div className="flex flex-col gap-4">
            <Toggle
              id="profile-share-email"
              label="Share email"
              checked={draft.sharing.email}
              onChange={(email) => patch({ sharing: { ...draft.sharing, email } })}
              description={profile?.contact.email ?? "The email on your sign-in account"}
            />
            <div className="flex flex-col gap-2">
              <Toggle
                id="profile-share-phone"
                label="Share phone"
                checked={draft.sharing.phone}
                onChange={(phone) => patch({ sharing: { ...draft.sharing, phone } })}
              />
              <label htmlFor="profile-phone" className="sr-only">
                Phone
              </label>
              <input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+254 700 000 000"
                maxLength={100}
                value={draft.phone}
                aria-invalid={invalid("phone")}
                aria-describedby={describedBy("phone")}
                onChange={(e) => patch({ phone: e.target.value })}
                className={inputClass}
              />
              <FieldError field="phone" errors={errors} />
            </div>
            <div className="flex flex-col gap-2">
              <Toggle
                id="profile-share-linkedin"
                label="Share LinkedIn"
                checked={draft.sharing.linkedin}
                onChange={(linkedin) => patch({ sharing: { ...draft.sharing, linkedin } })}
              />
              <label htmlFor="profile-linkedin" className="sr-only">
                LinkedIn
              </label>
              <input
                id="profile-linkedin"
                autoComplete="url"
                placeholder="linkedin.com/in/…"
                maxLength={100}
                value={draft.linkedin}
                aria-invalid={invalid("linkedin")}
                aria-describedby={describedBy("linkedin")}
                onChange={(e) => patch({ linkedin: e.target.value })}
                className={inputClass}
              />
              <FieldError field="linkedin" errors={errors} />
            </div>
            <FieldError field="sharing" errors={errors} />
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
          {saved ? (
            <p role="status" className="text-[13px] font-medium text-accent-green">
              Profile saved.
            </p>
          ) : null}
          <p className={helpClass}>Saved changes reach routes only after a BASIX admin confirms your account.</p>
        </div>
      </div>
    </form>
  );
}
