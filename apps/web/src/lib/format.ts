/** Display formats from the Sprint 002 business rules and the DESIGN.md block. */
import type { EvidenceType, RouteStatus } from "@venture-route/contracts";

/** `USD 370 / day` (D-16: integer USD per day). */
export function usd(amount: number): string {
  return `USD ${amount} / day`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { day: number; month: string; year: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d ?? 1, month: MONTHS[(m ?? 1) - 1] ?? "", year: y ?? 0 };
}

/** `22 Sep – 29 Sep 2026` (en dash, date-only, Africa/Nairobi). */
export function dateRange(startIso: string, endIso: string): string {
  const a = parts(startIso);
  const b = parts(endIso);
  const start = a.year === b.year ? `${a.day} ${a.month}` : `${a.day} ${a.month} ${a.year}`;
  return `${start} – ${b.day} ${b.month} ${b.year}`;
}

export const STATUS_LABEL: Record<RouteStatus, string> = {
  feasible: "Feasible",
  partial: "Partial",
  infeasible: "Infeasible",
};

/** DESIGN.md evidence badges: Credential, Project, Both (D-35). */
export const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  credential: "Credential",
  project: "Project",
  both: "Both",
};

/** `amina-otieno` → `Amina Otieno`, for ids the route carries without a display name. */
export function displayName(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
