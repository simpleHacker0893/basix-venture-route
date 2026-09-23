/** Showcase projects with their confirmation status and the link to the add-project screen. */
import type { Project } from "@venture-route/contracts";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { isoDate } from "../../lib/format";
import { helpClass } from "./formStyles";
import { Card, StatusPill } from "./StatusPill";

export function ProjectsCard({ projects, hasProfile }: Readonly<{ projects: Project[]; hasProfile: boolean }>) {
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
            <li key={project.id} aria-label={project.title} className="flex flex-wrap items-center justify-between gap-3 py-3">
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
                <StatusPill status={project.status} />
                <DemoDataPill />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No projects yet.</p>
      )}
    </Card>
  );
}
