import type { RouteBuilder } from "@venture-route/contracts";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { EvidenceBadge } from "./Badges";

type BuilderCardProps = Readonly<{
  builder: RouteBuilder;
  onViewEvidence?(builderId: string): void;
}>;

/** One selected builder: name, day rate, covered skills, evidence badge, Demo data pill. */
export function BuilderCard({ builder, onViewEvidence }: BuilderCardProps) {
  return (
    <article data-testid="builder-card" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold">{builder.name}</h3>
          <span className="font-mono text-[13px] text-ink-3">{builder.builderId}</span>
        </div>
        <DemoDataPill />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <EvidenceBadge evidence={builder.evidenceType} />
        <span className="font-mono text-sm">{usd(builder.dayRate)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-3">Covers</span>
        {builder.covers.map((skill) => (
          <span key={skill} className="rounded-pill border border-border-strong bg-surface-strong px-2.5 py-0.5">
            {SKILL_LABELS[skill]}
          </span>
        ))}
      </div>
      {onViewEvidence && (
        <button
          type="button"
          onClick={() => onViewEvidence(builder.builderId)}
          className="self-start text-[13px] text-accent-green underline"
        >
          View evidence path
        </button>
      )}
    </article>
  );
}
