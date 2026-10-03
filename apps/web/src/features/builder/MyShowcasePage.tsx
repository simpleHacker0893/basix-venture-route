/**
 * /my-showcase (builder, inside AppShell): the builder's own projects and where each one stands on
 * the public Showcase. The Showcase is display-only (AGENTS.md rule 4): nothing here touches routing.
 * A project is public only when it is showcased, BASIX confirmed the showcase entry, the project is
 * confirmed and the owner's account is confirmed; `showcaseState.ts` mirrors that to explain each
 * card in plain words. Publish and Withdraw use the existing `PUT /api/me/projects/{id}/showcase`
 * with the saved description and links sent back unchanged; "Edit details and links" is the
 * existing `ShowcaseEditor`.
 */
import type { AccountStatus, ShowcaseEditInput, ShowcaseProject } from "@venture-route/contracts";
import { Check, CircleAlert, Clock3, Info, Lock, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { errorMessage, helpClass } from "./formStyles";
import { ShowcaseEditor } from "./ShowcaseEditor";
import {
  cardCopy,
  countStates,
  savedLinks,
  showcaseBody,
  showcaseCardState,
  type ShowcaseCardState,
} from "./showcaseState";

const INTRO =
  "Projects you want the world to see. Turn on Show on Showcase for a project and BASIX reviews it. Once it is live, anyone can open it on the public Showcase.";

const JOURNEY: { title: string; body: string }[] = [
  { title: "Add a project", body: "Title, skills and a link to your work." },
  { title: "Publish to Showcase", body: "Turn on Show on Showcase to send it for review." },
  { title: "BASIX reviews it", body: "An admin confirms your account and the project." },
  { title: "It goes live", body: "Anyone can open it on the public Showcase." },
];

const OUTLINE_LINK =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent-green sm:h-10";
const SOLID_LINK =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover sm:h-10";

/** The pill, tile and "why" colours for a state; colour is never the only signal (the pill has text and an icon). */
const LOOK: Record<ShowcaseCardState, { pill: string; tile: string; why: string; Icon: typeof Check }> = {
  draft: { pill: "border border-border-strong bg-surface text-ink-2", tile: "bg-surface text-ink-2", why: "bg-surface text-ink-2", Icon: Pencil },
  waiting: { pill: "bg-amber-fill text-amber-ink", tile: "bg-amber-fill text-amber-ink", why: "bg-amber-fill/60 text-amber-ink", Icon: Clock3 },
  live: { pill: "bg-credential-tint text-accent-green", tile: "bg-credential-tint text-accent-green", why: "bg-credential-tint/60 text-accent-green", Icon: Check },
  "approved-account": { pill: "bg-credential-tint text-accent-green", tile: "bg-credential-tint text-accent-green", why: "bg-credential-tint/60 text-accent-green", Icon: Check },
  "approved-project": { pill: "bg-credential-tint text-accent-green", tile: "bg-credential-tint text-accent-green", why: "bg-credential-tint/60 text-accent-green", Icon: Check },
  "needs-changes": { pill: "bg-danger-tint text-danger", tile: "bg-danger-tint text-danger", why: "bg-danger-tint text-danger", Icon: CircleAlert },
};

type Loaded = { account: AccountStatus | null; projects: ShowcaseProject[] };

export function MyShowcasePage() {
  const api = useMarketplaceApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A message handed over by the screen that sent the builder here (e.g. a link that did not save).
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getProfile().then((p) => p.accountStatus as AccountStatus | null).catch((cause: unknown) => {
        if (cause instanceof ApiNotFoundError) return null; // no profile yet: nothing is confirmed
        throw cause;
      }),
      api.listProjects().catch((cause: unknown) => {
        if (cause instanceof ApiNotFoundError) return [] as ShowcaseProject[];
        throw cause;
      }),
    ])
      .then(([account, projects]) => {
        if (!cancelled) setLoaded({ account, projects });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "Your showcase could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function save(projectId: string, body: ShowcaseEditInput): Promise<ShowcaseProject> {
    const updated = await api.saveShowcase(projectId, body);
    setLoaded((current) =>
      current ? { ...current, projects: current.projects.map((p) => (p.id === projectId ? updated : p)) } : current,
    );
    return updated;
  }

  const account = loaded?.account ?? null;
  const projects = loaded?.projects ?? [];
  const states = projects.map((project) => showcaseCardState(project, account));
  const counts = countStates(states);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <h1 className="sr-only">My showcase</h1>
      <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">{INTRO}</p>

      {/* The same two actions as the top bar, for phones where the top bar holds only the menu. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <Link to="/profile/projects/new" className={SOLID_LINK}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add a project
        </Link>
        <Link to="/showcase" className={OUTLINE_LINK}>
          View public Showcase ↗
        </Link>
      </div>

      {notice ? (
        <p role="status" className="rounded-card border border-amber-ink/40 bg-amber-fill/40 px-3 py-2 text-[13px] text-amber-ink">
          {notice}
        </p>
      ) : null}

      {loaded && account !== "confirmed" ? (
        <section
          role="status"
          aria-label="Account status"
          className="flex items-start gap-3 rounded-2xl border border-amber-ink/30 bg-amber-fill/60 p-4 sm:items-center sm:p-5"
        >
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-fill text-amber-ink">
            <Lock className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-amber-ink">
            <p className="text-[15px] font-semibold">
              {account === "rejected" ? "Your account was not confirmed" : "Your account is waiting for BASIX to confirm it"}
            </p>
            <p className="text-[13.5px] leading-relaxed">
              {account === "rejected"
                ? "Check your profile details and evidence. Nothing goes public until your account and the project are both confirmed."
                : "You can add projects and links now. Nothing goes public until your account and the project are both confirmed."}
            </p>
          </div>
          <Link to="/home" className="hidden shrink-0 text-[14px] font-semibold underline underline-offset-4 sm:inline">
            See my progress
          </Link>
        </section>
      ) : null}

      <ol aria-label="How a project goes live" className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        {JOURNEY.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-credential-tint text-[13px] font-semibold text-accent-green">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-ink">{step.title}</span>
              <span className="text-[13.5px] leading-snug text-ink-3">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}

      {loaded === null && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading your showcase…
        </p>
      ) : null}

      {loaded ? (
        <>
          <ul aria-label="Showcase totals" className="flex flex-wrap gap-2">
            <Counter n={counts.live} label="Live" />
            <Counter n={counts.waiting} label="Waiting for review" />
            <Counter n={counts.draft} label="Draft" />
            {counts.needsChanges > 0 ? <Counter n={counts.needsChanges} label="Needs changes" /> : null}
          </ul>

          {projects.length === 0 ? (
            <section aria-label="No projects" className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-strong p-6">
              <h2 className="font-display text-xl font-semibold text-ink">No projects yet</h2>
              <p className="max-w-xl text-[14px] leading-relaxed text-ink-3">
                Add a project with a link to your work. It stays private to you until you publish it.
              </p>
              <Link to="/profile/projects/new" className={`${SOLID_LINK} w-full sm:w-auto`}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add a project
              </Link>
            </section>
          ) : (
            <ul aria-label="Projects" className="flex flex-col gap-4">
              {projects.map((project, index) => (
                <ProjectCard key={project.id} project={project} state={states[index]!} account={account} onSave={save} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function Counter({ n, label }: Readonly<{ n: number; label: string }>) {
  return (
    <li className="inline-flex h-10 items-center gap-2 rounded-pill border border-border bg-surface-strong px-3.5 text-[13px] text-ink-2">
      <span className="font-display text-[18px] leading-none text-ink">{n}</span>
      {label}
    </li>
  );
}

type ProjectCardProps = Readonly<{
  project: ShowcaseProject;
  state: ShowcaseCardState;
  account: AccountStatus | null;
  onSave(projectId: string, body: ShowcaseEditInput): Promise<ShowcaseProject>;
}>;

function ProjectCard({ project, state, account, onSave }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = cardCopy(state, account);
  const look = LOOK[state];
  const links = savedLinks(project);
  const editorId = `showcase-editor-${project.id}`;

  /** Publish or Withdraw: the saved description and links go back unchanged, only `showcased` flips. */
  async function setShowcased(showcased: boolean) {
    setBusy(true);
    setError(null);
    try {
      await onSave(project.id, showcaseBody(project, showcased));
    } catch (cause) {
      setError(errorMessage(cause, showcased ? "This project could not be published." : "This project could not be withdrawn."));
    } finally {
      setBusy(false);
    }
  }

  const editButton = (label: string, primary: boolean) => (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      size="lg"
      aria-expanded={editing}
      aria-controls={editorId}
      onClick={() => setEditing((open) => !open)}
      className="w-full sm:h-10 sm:w-auto"
    >
      {label}
    </Button>
  );

  return (
    <li aria-label={project.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-[22px] ${look.tile}`}>
            {project.title.trim().charAt(0).toUpperCase() || "P"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words font-display text-[20px] font-semibold leading-tight text-ink">{project.title}</h2>
              <span data-testid="state-pill" className={`inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-[12px] font-semibold ${look.pill}`}>
                <look.Icon aria-hidden="true" className="h-3 w-3" />
                {copy.pill}
              </span>
              {project.demoData ? <DemoDataPill /> : null}
            </div>
            <p className="text-[13.5px] text-ink-3">
              {VERTICAL_LABELS[project.vertical]} · {project.status === "confirmed" ? "Confirmed project" : project.status === "rejected" ? "Project rejected" : "Project in review"} ·
              Licensable: {project.licensable ? "yes" : "no"}
            </p>
            {project.skillIds.length > 0 ? (
              <p className="text-[13px] text-ink-3">{project.skillIds.map((skill) => SKILL_LABELS[skill]).join(", ")}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface-strong px-3.5 text-[13.5px] text-ink-2 hover:border-accent-green hover:text-accent-green sm:min-h-9"
                >
                  {link.label} ↗
                </a>
              ))}
              {links.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-11 items-center rounded-pill border border-dashed border-border-strong px-3.5 text-[13.5px] font-medium text-accent-green hover:border-accent-green sm:min-h-9"
                >
                  + Add a link
                </button>
              ) : null}
            </div>
            <p className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed ${look.why}`}>
              {state === "draft" ? <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : <look.Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{copy.why}</span>
            </p>
            {error ? (
              <p role="alert" className="rounded-card border border-danger/40 bg-surface px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-[220px] lg:shrink-0">
          {state === "draft" ? (
            <Button type="button" size="lg" disabled={busy} aria-busy={busy} onClick={() => void setShowcased(true)} className="w-full sm:h-10">
              {busy ? "Publishing…" : "Publish to Showcase"}
            </Button>
          ) : null}
          {state === "waiting" ? (
            <Button type="button" variant="outline" size="lg" disabled={busy} aria-busy={busy} onClick={() => void setShowcased(false)} className="w-full sm:h-10">
              {busy ? "Withdrawing…" : "Withdraw from review"}
            </Button>
          ) : null}
          {state === "live" ? (
            <Link to={`/showcase/${encodeURIComponent(project.id)}`} className={`${SOLID_LINK} w-full`}>
              View live page ↗
            </Link>
          ) : null}
          {state === "needs-changes" ? editButton("Edit and resubmit", true) : editButton("Edit details and links", false)}
        </div>
      </div>

      {editing ? <ShowcaseEditor project={project} onSave={onSave} /> : null}
      {state === "needs-changes" && !editing ? <p className={helpClass}>Saving with Show on Showcase on sends it back to BASIX for review.</p> : null}
    </li>
  );
}
