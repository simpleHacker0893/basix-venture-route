/**
 * The Showcase builder panel (spec #86 story 42, prompt 6.2, composed from batch-3
 * candidate-profile): name, cohort line, verified skills with evidence badges, the
 * "Self-described" chips (never labelled verified), confirmed certifications with a Verify
 * link, GitHub/LinkedIn icon links, and "View builder" — a signed-in founder goes to
 * `/builders/:builderId`, anyone else to `/sign-in`. `ShowcaseBuilder` carries no contact
 * field (D-43); nothing here ever renders one.
 */
import type { ShowcaseBuilder } from "@venture-route/contracts";
import { Link } from "react-router";

import { isoDate } from "../../lib/format";
import { useAuthState } from "../../auth/authContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { EvidenceBadge } from "../route/Badges";

const EXTERNAL_REL = "noopener noreferrer";

export function BuilderPanel({ builder }: Readonly<{ builder: ShowcaseBuilder }>) {
  const auth = useAuthState();
  const isFounder = auth.isSignedIn && auth.role === "founder";
  const viewBuilderTo = isFounder ? `/builders/${builder.builderId}` : "/sign-in";

  return (
    <aside aria-label="Builder" className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold text-ink">{builder.displayName}</h2>
        {builder.cohortId ? <p className="text-sm text-ink-muted">{builder.cohortId}</p> : null}
      </div>

      <section aria-label="Verified skills" className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Verified skills</h3>
        {builder.verifiedSkills.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {builder.verifiedSkills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-medium text-ink">{skill.name}</span>
                {skill.evidence ? <EvidenceBadge evidence={skill.evidence} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No verified skills on record.</p>
        )}
      </section>

      <section aria-label="Self-described" className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Self-described</h3>
        {builder.skillSet.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {builder.skillSet.map((label) => (
              <span
                key={label}
                className="inline-flex h-8 items-center rounded-pill border border-border-strong px-3 text-sm text-ink-2"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No self-described skills on record.</p>
        )}
      </section>

      <section aria-label="Certifications" className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Certifications</h3>
        {builder.certifications.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {builder.certifications.map((cert) => (
              <li key={cert.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-strong p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{cert.title}</span>
                  {cert.demoData ? <DemoDataPill /> : null}
                </div>
                <span className="text-[13px] text-ink-muted">{cert.issuer}</span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {cert.issuedOn ? <span className="font-mono text-[12px] text-ink-3">{isoDate(cert.issuedOn)}</span> : null}
                  {cert.credentialUrl ? (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel={EXTERNAL_REL}
                      className="text-[13px] font-medium text-accent-green underline hover:text-accent-green-hover"
                    >
                      Verify
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No certifications on record.</p>
        )}
      </section>

      {builder.githubUrl || builder.linkedinUrl ? (
        <div className="flex items-center gap-4">
          {builder.githubUrl ? (
            <a
              href={builder.githubUrl}
              target="_blank"
              rel={EXTERNAL_REL}
              className="text-[13px] font-medium text-ink-2 underline hover:text-ink"
            >
              GitHub
            </a>
          ) : null}
          {builder.linkedinUrl ? (
            <a
              href={builder.linkedinUrl}
              target="_blank"
              rel={EXTERNAL_REL}
              className="text-[13px] font-medium text-ink-2 underline hover:text-ink"
            >
              LinkedIn
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <Link
          to={viewBuilderTo}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-accent-green text-sm font-medium text-white hover:bg-accent-green-hover"
        >
          View builder
        </Link>
        <p className="text-[13px] text-ink-3">Contact details are shown only to signed-in founders.</p>
      </div>
    </aside>
  );
}
