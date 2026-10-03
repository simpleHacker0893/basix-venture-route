/**
 * The profile's "Showcase projects" section: a short list (title, meta, status pill) with a link to
 * manage everything in My showcase and a link to add a project. Publishing, links and the showcase
 * editor live on /my-showcase; this card only summarises.
 */
import type { AccountStatus, ShowcaseProject as ShowcaseProjectT } from "@venture-route/contracts";
import { Link } from "react-router";

import { VERTICAL_LABELS } from "../../lib/brief";
import { helpClass } from "./formStyles";
import { cardCopy, savedLinks, showcaseCardState } from "./showcaseState";
import { Card } from "./StatusPill";

const PILL: Record<ReturnType<typeof showcaseCardState>, string> = {
  draft: "border border-border-strong bg-surface text-ink-2",
  waiting: "bg-amber-fill text-amber-ink",
  live: "bg-credential-tint text-accent-green",
  "approved-account": "bg-credential-tint text-accent-green",
  "approved-project": "bg-credential-tint text-accent-green",
  "needs-changes": "bg-danger-tint text-danger",
};

type ProjectsCardProps = Readonly<{
  projects: ShowcaseProjectT[];
  hasProfile: boolean;
  account: AccountStatus | null;
}>;

export function ProjectsCard({ projects, hasProfile, account }: ProjectsCardProps) {
  return (
    <Card
      id="showcase"
      className="scroll-mt-24"
      title="Showcase projects"
      eyebrow="Proof"
      lead="A confirmed completed project demonstrates its skills (verified-for-skill, evidence project)."
      aside={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/my-showcase"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-strong px-3 text-sm font-medium text-ink transition-colors hover:border-accent-green sm:h-9"
          >
            Manage in My showcase →
          </Link>
          <Link
            to="/profile/projects/new"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent-green px-3 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover sm:h-9"
          >
            Add a project
          </Link>
        </div>
      }
    >
      {!hasProfile ? <p className={helpClass}>Save your profile first, then add projects.</p> : null}
      {projects.length > 0 ? (
        <ul aria-label="Projects" className="flex flex-col divide-y divide-border">
          {projects.map((project) => {
            const state = showcaseCardState(project, account);
            const links = savedLinks(project).length;
            return (
              <li key={project.id} aria-label={project.title} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="break-words text-sm font-medium text-ink">{project.title}</span>
                  <span className="text-[12px] text-ink-3">
                    {VERTICAL_LABELS[project.vertical]} · {links === 0 ? "no link yet" : links === 1 ? "1 link" : `${links} links`}
                  </span>
                </div>
                <span className={`inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[12px] font-semibold ${PILL[state]}`}>
                  {cardCopy(state, account).pill}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No projects yet.</p>
      )}
    </Card>
  );
}
