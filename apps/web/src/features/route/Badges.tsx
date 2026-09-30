import type { EvidenceType, RouteStatus } from "@venture-route/contracts";

import { EVIDENCE_LABEL, STATUS_LABEL } from "../../lib/format";

const STATUS_CLASS: Record<RouteStatus, string> = {
  feasible: "bg-credential-tint text-accent-green",
  partial: "bg-amber-fill text-amber-ink",
  infeasible: "bg-danger-tint text-danger",
};

/** Status badge: exactly `Feasible`, `Partial` or `Infeasible` (requirements.md Business rules). */
export function StatusBadge({ status }: Readonly<{ status: RouteStatus }>) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium ${STATUS_CLASS[status]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const EVIDENCE_CLASS: Record<EvidenceType, string> = {
  credential: "bg-credential-tint text-accent-green",
  project: "bg-project-tint text-project",
  both: "bg-sage text-accent-green",
};

/** Evidence badge: `Credential`, `Project`, `Both` with an indigo dot (DESIGN.md, D-35). */
export function EvidenceBadge({ evidence }: Readonly<{ evidence: EvidenceType }>) {
  return (
    <span
      data-testid="evidence-badge"
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[13px] font-medium ${EVIDENCE_CLASS[evidence]}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${evidence === "both" ? "bg-project" : "bg-current"}`} />
      {EVIDENCE_LABEL[evidence]}
    </span>
  );
}
