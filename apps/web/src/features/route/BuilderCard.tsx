import type { RouteBuilder } from "@venture-route/contracts";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS } from "../../lib/brief";
import { usdPerHour } from "../../lib/format";
import { EvidenceBadge } from "./Badges";

type BuilderCardProps = Readonly<{
  builder: RouteBuilder;
  onViewEvidence?(builderId: string): void;
}>;

/** One selected builder: name, day rate, covered skills, evidence badge, Demo data pill. */
export function BuilderCard({ builder, onViewEvidence }: BuilderCardProps) {
  return (
    <article
      data-testid="builder-card"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-strong p-6 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage text-[13px] font-semibold text-accent-green"
        >
          {builder.name
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-[17px] font-semibold text-ink">{builder.name}</h3>
          <span data-testid="builder-id" translate="no" className="font-mono text-[13px] text-ink-3">
            {builder.builderId}
          </span>
        </div>
        <DemoDataPill />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <EvidenceBadge evidence={builder.evidenceType} />
        <span className="font-mono text-sm text-ink-2">{usdPerHour(builder.hourlyRate)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
        <span className="text-ink-3">Covers</span>
        {builder.covers.map((skill) => (
          <span key={skill} className="rounded-pill border border-border bg-surface px-2.5 py-0.5 text-ink-2">
            {SKILL_LABELS[skill]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {onViewEvidence && (
          <button
            type="button"
            onClick={() => onViewEvidence(builder.builderId)}
            className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-green underline-offset-4 hover:underline sm:min-h-0"
          >
            View evidence path
          </button>
        )}
        {/* Sprint 003 #46: the founder's candidate view; seed builders explain themselves there. */}
        <Link
          to={`/builders/${encodeURIComponent(builder.builderId)}`}
          className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-green underline-offset-4 hover:underline sm:min-h-0"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}
