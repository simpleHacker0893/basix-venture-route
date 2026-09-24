/**
 * Credentials: the builder's proof rows with their confirmation status and the small
 * add-credential form (title, issuer, skill). Pending until a BASIX admin confirms.
 */
import { CredentialInput, type Credential, type CredentialInput as CredentialInputT } from "@venture-route/contracts";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ApiNotFoundError, ApiValidationError } from "../../api/client";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILLS, SKILL_LABELS } from "../../lib/brief";
import { splitFieldMessages } from "../../lib/validationError";
import { errorMessage, helpClass, inputClass, labelClass } from "./formStyles";
import { Card, FieldError, StatusPill } from "./StatusPill";

const CREDENTIAL_FIELDS = ["title", "issuer", "skillId"] as const;

type CredentialsCardProps = Readonly<{
  credentials: Credential[];
  /** False before the profile exists: the engine answers 404 "no profile yet" on POST. */
  hasProfile: boolean;
  onAdd(input: CredentialInputT): Promise<void>;
}>;

export function CredentialsCard({ credentials, hasProfile, onAdd }: CredentialsCardProps) {
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [skillId, setSkillId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CredentialInput.safeParse({ title: title.trim(), issuer: issuer.trim(), skillId: skillId || undefined });
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
      await onAdd(parsed.data);
      setTitle("");
      setIssuer("");
      setSkillId("");
    } catch (cause) {
      if (cause instanceof ApiValidationError) {
        setErrors(Object.fromEntries(splitFieldMessages(cause.message, CREDENTIAL_FIELDS, {}).map((m) => [m.field, m.text])));
      } else if (cause instanceof ApiNotFoundError) {
        setErrors({ form: "Save your profile first, then add credentials." });
      } else {
        setErrors({ form: errorMessage(cause, "The credential could not be added.") });
      }
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `error-${field}` : undefined);

  return (
    <Card title="Credentials" eyebrow="Proof" lead="A confirmed credential proves a skill (verified-for-skill, evidence credential).">
      {credentials.length > 0 ? (
        <ul aria-label="Credentials" className="flex flex-col divide-y divide-border">
          {credentials.map((credential) => (
            <li key={credential.id} aria-label={credential.title} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">{credential.title}</span>
                <span className="text-[12px] text-ink-3">
                  {credential.issuer} ·{" "}
                  {credential.skillId ? SKILL_LABELS[credential.skillId] : "No vocabulary skill"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={credential.status} />
                <DemoDataPill />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No credentials yet.</p>
      )}
      <form aria-label="Add credential" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3 border-t border-border pt-4">
        {errors.form ? (
          <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
            {errors.form}
          </p>
        ) : null}
        {!hasProfile ? <p className={helpClass}>Save your profile first, then add credentials.</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="credential-title" className={labelClass}>
              Credential title
            </label>
            <input
              id="credential-title"
              autoComplete="off"
              maxLength={120}
              value={title}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describedBy("title")}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors({});
              }}
              className={inputClass}
            />
            <FieldError field="title" errors={errors} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="credential-issuer" className={labelClass}>
              Issuer
            </label>
            <input
              id="credential-issuer"
              autoComplete="organization"
              maxLength={120}
              value={issuer}
              aria-invalid={errors.issuer ? true : undefined}
              aria-describedby={describedBy("issuer")}
              onChange={(e) => {
                setIssuer(e.target.value);
                setErrors({});
              }}
              className={inputClass}
            />
            <FieldError field="issuer" errors={errors} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="credential-skill" className={labelClass}>
              Skill
            </label>
            <select
              id="credential-skill"
              value={skillId}
              aria-invalid={errors.skillId ? true : undefined}
              aria-describedby={describedBy("skillId")}
              onChange={(e) => {
                setSkillId(e.target.value);
                setErrors({});
              }}
              className={inputClass}
            >
              <option value="">Choose a skill</option>
              {SKILLS.map((skill) => (
                <option key={skill} value={skill}>
                  {SKILL_LABELS[skill]}
                </option>
              ))}
            </select>
            <FieldError field="skillId" errors={errors} />
          </div>
        </div>
        <Button type="submit" variant="outline" size="sm" className="w-fit" disabled={busy || !hasProfile} aria-busy={busy}>
          {busy ? "Adding…" : "Add credential"}
        </Button>
      </form>
    </Card>
  );
}
