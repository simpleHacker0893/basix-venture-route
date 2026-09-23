/**
 * /builders/:builderId (screen 12, Stitch batch-3/candidate-profile, D-36): the founder's (and
 * admin's) view of one confirmed builder. The engine decides which contact keys are present
 * (sharing toggles, DOMAIN.md §Marketplace) and every skill's `status` and `evidence`; this
 * screen renders what the API said and nothing more. Seed builders have no account row, so a
 * 404 renders the "seed builder" state instead of an error.
 */
import type { Candidate, Project } from "@venture-route/contracts";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { EVIDENCE_LABEL, dateRange, isoDate, usd } from "../../lib/format";
import { errorMessage } from "../builder/formStyles";
import { EvidenceBadge } from "../route/Badges";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; candidate: Candidate }
  | { kind: "seed" }
  | { kind: "error"; message: string };

/** The rules a route evaluates for a builder (DOMAIN.md §Named rules); listed, never claimed as evaluated here. */
const BUILDER_RULES = ["verified-for-skill", "mode-compatible", "available-for-brief", "eligible-builder"] as const;

function modeLabels(modes: Candidate["modes"]): string {
  const labels: string[] = [];
  if (modes.remote) labels.push("Remote");
  if (modes.hybrid) labels.push("Hybrid");
  if (modes.onSite) labels.push("On-site");
  return labels.length > 0 ? labels.join(", ") : "None";
}

function availabilityLabel(availability: Candidate["availability"]): string {
  if (availability.length === 0) return "None on record";
  return availability.map((range) => dateRange(range.start, range.end)).join("; ");
}

function shortProjectId(id: string): string {
  return `proj-${id.replace(/-/g, "").slice(0, 8)}`;
}

export function CandidatePage() {
  const { builderId = "" } = useParams();
  const api = useMarketplaceApi();
  // Keyed by builder id so a navigation between builders derives "loading" instead of resetting state in the effect.
  const [result, setResult] = useState<{ builderId: string; state: State } | null>(null);
  const state: State = result !== null && result.builderId === builderId ? result.state : { kind: "loading" };

  useEffect(() => {
    let cancelled = false;
    api
      .getCandidate(builderId)
      .then((candidate) => {
        if (!cancelled) setResult({ builderId, state: { kind: "loaded", candidate } });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const next: State =
          cause instanceof ApiNotFoundError
            ? { kind: "seed" }
            : { kind: "error", message: errorMessage(cause, "This builder could not be loaded.") };
        setResult({ builderId, state: next });
      });
    return () => {
      cancelled = true;
    };
  }, [api, builderId]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div>
        <Link to="/route" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <span aria-hidden="true">←</span>
          <span>Back to route</span>
        </Link>
      </div>

      {state.kind === "loading" ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading builder…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {state.message}
        </p>
      ) : null}

      {state.kind === "seed" ? <SeedBuilderState builderId={builderId} /> : null}

      {state.kind === "loaded" ? <CandidateView candidate={state.candidate} /> : null}
    </div>
  );
}

/** A seed builder (amina-otieno and friends) lives in the demo graph only; there is no profile to show. */
function SeedBuilderState({ builderId }: Readonly<{ builderId: string }>) {
  return (
    <section aria-label="Seed builder" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Seed builder</h1>
        <DemoDataPill />
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
        <span translate="no" className="font-mono text-ink">
          {builderId}
        </span>{" "}
        is a seed builder. Seed builders come from the demo graph the engine loads at start-up and have no marketplace
        profile, so there is no candidate view to show. Their evidence paths are on the route result.
      </p>
      <Link to="/route" className="self-start text-[13px] text-accent-green underline hover:text-accent-green-hover">
        Back to route
      </Link>
    </section>
  );
}

function CandidateView({ candidate }: Readonly<{ candidate: Candidate }>) {
  const verified = candidate.skills.filter((skill) => skill.status === "verified");
  const roleLine = [candidate.headline, candidate.cohortId].filter((part) => part && part.length > 0).join(" · ");

  return (
    <>
      <section aria-label="Candidate" className="flex flex-col rounded-card border border-border bg-surface">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold text-ink">{candidate.displayName}</h1>
              {candidate.confirmed ? (
                <span className="inline-flex h-6 items-center rounded-pill bg-accent-green px-2.5 text-[12px] font-medium text-white">
                  Confirmed by admin
                </span>
              ) : null}
              {candidate.demoData ? <DemoDataPill /> : null}
            </div>
            {roleLine ? <p className="text-sm text-ink-muted">{roleLine}</p> : null}
          </div>
          {/* Requests and interviews are Sprint 004; the Stitch buttons stay visible but disabled. */}
          <div className="flex flex-col items-start gap-1 md:items-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                aria-describedby="sprint-004-hint"
                className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to request
              </button>
              <button
                type="button"
                disabled
                aria-describedby="sprint-004-hint"
                className="inline-flex h-9 items-center rounded-lg bg-accent-green px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Book interview
              </button>
            </div>
            <span id="sprint-004-hint" className="text-[12px] text-ink-3">
              Requests and interviews arrive in Sprint 004.
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-border px-6 py-4 font-mono text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-3">Rate:</dt>
            <dd className="text-ink">{usd(candidate.dayRate)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-3">Availability:</dt>
            <dd className="text-ink">{availabilityLabel(candidate.availability)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-3">Modes:</dt>
            <dd className="text-ink">{modeLabels(candidate.modes)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-3">Location:</dt>
            <dd className="text-ink">{candidate.location}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <section aria-label="Skills" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">Verified skills</h2>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {verified.length} verified
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Skills as the engine reports them. A skill is verified only when a confirmed credential or confirmed project
              proves it; self-described skills are display only.
            </p>
            {candidate.skills.length > 0 ? (
              <ul aria-label="Verified skills" className="flex flex-col divide-y divide-border">
                {candidate.skills.map((skill) => (
                  <li key={skill.id} aria-label={skill.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-ink">{skill.name}</span>
                      {skill.status === "verified" && skill.evidence ? (
                        <EvidenceBadge evidence={skill.evidence} />
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-pill border border-border-strong px-2.5 text-[12px] text-ink-3">
                          Self-described
                        </span>
                      )}
                    </div>
                    {skill.status === "verified" && skill.evidence ? (
                      <span className="text-[12px] text-ink-3">Evidence: {EVIDENCE_LABEL[skill.evidence].toLowerCase()}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1 text-[12px] text-ink-3">
                        <span>Self-described · display only</span>
                        <span>· Not used for routing.</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No skills on record.</p>
            )}
          </section>

          <section aria-label="Projects" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">Projects</h2>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {candidate.projects.length} confirmed
              </span>
            </div>
            {candidate.projects.length > 0 ? (
              <ul aria-label="Confirmed projects" className="flex flex-col gap-4">
                {candidate.projects.map((project) => (
                  <li key={project.id}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No confirmed projects yet.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section aria-label="Evidence summary" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Evidence summary</h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Verified skills with their evidence type and the confirmed projects, as the engine reports them.
            </p>
            {verified.length > 0 || candidate.projects.length > 0 ? (
              <ul
                aria-label="Evidence lines"
                translate="no"
                className="flex flex-col gap-1 rounded-card bg-dark p-4 font-mono text-[13px] text-accent-on-dark"
              >
                {verified.map((skill) => (
                  <li key={skill.id}>
                    {skill.id} · verified · {skill.evidence ?? "—"}
                  </li>
                ))}
                {candidate.projects.map((project) => (
                  <li key={project.id}>
                    {shortProjectId(project.id)} · confirmed · {project.skillIds.join(" ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No verified evidence on record.</p>
            )}
            <p className="rounded-card border border-border bg-surface-strong px-3 py-2 text-[13px] leading-relaxed text-ink-2">
              Rules that apply to this builder in routing:{" "}
              {BUILDER_RULES.map((rule, index) => (
                <span key={rule}>
                  {index > 0 ? ", " : ""}
                  <code className="font-mono text-ink">{rule}</code>
                </span>
              ))}
              . A route evaluates them against one brief; this page lists them only.
            </p>
          </section>

          <SharedContactCard contact={candidate.contact} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-card bg-dark px-4 py-3 font-mono text-[12px] text-accent-on-dark md:flex-row md:items-center md:justify-between">
        <span>Rules that apply in routing: {BUILDER_RULES.join(" · ")}</span>
        <span translate="no" className="text-ledger-dim">
          {candidate.builderId}
        </span>
      </div>
    </>
  );
}

function ProjectCard({ project }: Readonly<{ project: Project }>) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{project.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {project.licensable ? (
            <span className="inline-flex h-6 items-center rounded-pill border border-project px-2.5 text-[12px] font-medium text-project">
              Licensable
            </span>
          ) : null}
          <span className="inline-flex h-6 items-center rounded-pill border border-border-strong px-2.5 text-[12px] text-ink-2">
            {VERTICAL_LABELS[project.vertical]}
          </span>
          {project.demoData ? <DemoDataPill /> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {project.skillIds.map((skill) => (
          <span key={skill} className="rounded-pill border border-border-strong bg-surface px-2 py-0.5 text-[12px]">
            {SKILL_LABELS[skill]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[12px] text-ink-3">
        <span>Completed: {isoDate(project.completedOn)}</span>
        <span translate="no">{shortProjectId(project.id)}</span>
      </div>
    </article>
  );
}

const CONTACT_LABELS: Record<keyof Candidate["contact"], string> = {
  email: "Email:",
  phone: "Phone:",
  linkedin: "LinkedIn:",
};

/** Only the keys the builder shares arrive from the engine; an unshared key is absent (null after parsing) and gets no line. */
function SharedContactCard({ contact }: Readonly<{ contact: Candidate["contact"] }>) {
  const shared = (Object.keys(CONTACT_LABELS) as (keyof Candidate["contact"])[]).filter((key) => contact[key] !== null);
  return (
    <section aria-label="Shared contact" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <h2 className="font-display text-xl font-semibold text-ink">Shared contact</h2>
      {shared.length > 0 ? (
        <dl className="flex flex-col divide-y divide-border font-mono text-[13px]">
          {shared.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-ink-3">{CONTACT_LABELS[key]}</dt>
              <dd className="text-ink">{contact[key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="font-mono text-[13px] text-ink-3">Contact details not shared.</p>
      )}
      <p className="text-[12px] text-ink-3">Builders choose what founders can see.</p>
    </section>
  );
}
