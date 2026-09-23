import type { EvidenceType, RouteStatus } from "@venture-route/contracts";

import { EVIDENCE_LABEL, STATUS_LABEL } from "../../lib/format";

const STATUS_CLASS: Record<RouteStatus, string> = {
  feasible: "bg-accent-green text-white",
  partial: "bg-amber-fill text-amber-ink",
  infeasible: "bg-danger text-white",
};

/** Status badge: exactly `Feasible`, `Partial` or `Infeasible` (requirements.md Business rules). */
export function StatusBadge({ status }: Readonly<{ status: RouteStatus }>) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex h-6 items-center rounded-pill px-3 text-[13px] font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const EVIDENCE_CLASS: Record<EvidenceType, string> = {
  credential: "border-accent-green text-accent-green",
  project: "border-project text-project",
  both: "border-accent-green bg-accent-green text-white",
};

/** Evidence badge: `Credential`, `Project`, `Both` with an indigo dot (DESIGN.md, D-35). */
export function EvidenceBadge({ evidence }: Readonly<{ evidence: EvidenceType }>) {
  return (
    <span
      data-testid="evidence-badge"
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill border px-2.5 text-[13px] font-medium ${EVIDENCE_CLASS[evidence]}`}
    >
      {evidence === "both" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-project" />}
      {EVIDENCE_LABEL[evidence]}
    </span>
  );
}
