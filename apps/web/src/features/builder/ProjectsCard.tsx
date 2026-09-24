/**
 * Showcase projects with their confirmation status, the link to the add-project screen, and a
 * per-project `ShowcaseEditor` (spec #86 stories 1-13, #99) behind an "Edit showcase" toggle.
 */
import type { ShowcaseEditInput, ShowcaseProject as ShowcaseProjectT } from "@venture-route/contracts";
import { useState } from "react";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { isoDate } from "../../lib/format";
import { helpClass } from "./formStyles";
import { ShowcaseEditor } from "./ShowcaseEditor";
import { Card, ShowcaseStatusPill, StatusPill } from "./StatusPill";

const PENDING_NOTE = "A BASIX admin reviews every change before it goes live.";

type ProjectsCardProps = Readonly<{
  projects: ShowcaseProjectT[];
  hasProfile: boolean;
  onSaveShowcase(projectId: string, body: ShowcaseEditInput): Promise<ShowcaseProjectT>;
}>;

export function ProjectsCard({ projects, hasProfile, onSaveShowcase }: ProjectsCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card
      title="Showcase projects"
      eyebrow="Proof"
      lead="A confirmed completed project demonstrates its skills (verified-for-skill, evidence project)."
      aside={
        <Link
          to="/profile/projects/new"
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-sm font-medium text-ink transition-colors hover:border-accent-green"
        >
          Add a showcase project
        </Link>
      }
    >
      {!hasProfile ? <p className={helpClass}>Save your profile first, then add projects.</p> : null}
      {projects.length > 0 ? (
        <ul aria-label="Projects" className="flex flex-col divide-y divide-border">
          {projects.map((project) => (
            <li key={project.id} aria-label={project.title} className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-ink">{project.title}</span>
                  <span className="text-[12px] text-ink-3">
                    {VERTICAL_LABELS[project.vertical]} · completed {isoDate(project.completedOn)}
                    {project.licensable ? " · licensable as reusable IP" : ""}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.skillIds.map((skill) => (
                      <span key={skill} className="rounded-pill border border-border-strong bg-surface-strong px-2 py-0.5 text-[12px]">
                        {SKILL_LABELS[skill]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShowcaseStatusPill status={project.showcaseStatus} />
                  <StatusPill status={project.status} />
                  <DemoDataPill />
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => (current === project.id ? null : project.id))}
                    className="text-[13px] text-ink-2 underline-offset-4 hover:text-accent-green hover:underline"
                  >
                    {expanded === project.id ? "Close" : "Edit showcase"}
                  </button>
                </div>
              </div>
              {project.showcaseStatus === "pending" ? <p className="text-[13px] text-ink-2">{PENDING_NOTE}</p> : null}
              {expanded === project.id ? <ShowcaseEditor project={project} onSave={onSaveShowcase} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No projects yet.</p>
      )}
    </Card>
  );
}
