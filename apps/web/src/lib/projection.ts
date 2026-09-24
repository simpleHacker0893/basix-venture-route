/**
 * Preview of the facts a pending row would add to the MeTTa space once confirmed (Sprint 003 #46).
 * Mirrors `services/engine/app/engine/projection.py::render_program` line for line: the same seed
 * predicates, the same `admin-basix` symbol and the same eight-character short id. It is a preview
 * rendered from the row's fields, not a ledger and not the engine's projection itself; the engine
 * rebuilds the space from confirmed rows in the same request as the decision (D-15).
 */
import type { PendingAccount, PendingCredential, PendingProject } from "@venture-route/contracts";

export const ADMIN_SYMBOL = "admin-basix";

/** First eight hex characters of the row UUID without dashes, as the engine derives `cred-` and `proj-` ids. */
export function shortId(rowId: string): string {
  return rowId.replace(/-/g, "").slice(0, 8);
}

/**
 * One quoted MeTTa string atom, mirroring `app/engine/projection.py::metta_string` for the
 * characters a preview is likely to show (backslash, quote and the common whitespace escapes);
 * this is a preview helper, not the engine's own encoder.
 */
function mettaString(text: string): string {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

export type ProjectionPreview = {
  facts: string[];
  /** What the preview cannot show from this row alone. */
  note: string;
};

export function accountPreview(account: PendingAccount): ProjectionPreview {
  if (account.role !== "builder" || account.builderId === null) {
    return {
      facts: [],
      note: "Founder accounts add no graph facts; confirmation only makes the account visible in the marketplace.",
    };
  }
  const facts = [`(confirmed ${ADMIN_SYMBOL} ${account.builderId})`];
  if (account.cohortId) facts.push(`(belongs-to ${account.builderId} ${account.cohortId})`);
  return {
    facts,
    note:
      "Profile facts (day-rate, located-in, supports-mode, available, has-self-described-skill) are projected from the saved profile once the account is confirmed.",
  };
}

export function credentialPreview(credential: PendingCredential): ProjectionPreview {
  const cred = `cred-${shortId(credential.id)}`;
  // A skill-less certification never earns or proves anything: it becomes exactly one
  // display-only `certified` fact that no rule reads (D-52), not `earned`/`proves`/`confirmed`.
  if (credential.skillId === null) {
    return {
      facts: [`(certified ${credential.builderId} ${cred} ${mettaString(credential.issuer)})`],
      note: "Outside the nine-skill vocabulary, so this stays a display-only certified fact: it never satisfies verified-for-skill.",
    };
  }
  return {
    facts: [
      `(earned ${credential.builderId} ${cred})`,
      `(proves ${cred} ${credential.skillId})`,
      `(confirmed ${ADMIN_SYMBOL} ${cred})`,
    ],
    note: "With these facts verified-for-skill can hold by credential for the named skill.",
  };
}

export function projectPreview(project: PendingProject): ProjectionPreview {
  const proj = `proj-${shortId(project.id)}`;
  const facts = [
    `(built ${project.builderId} ${proj})`,
    ...project.skillIds.map((skill) => `(demonstrates ${proj} ${skill})`),
    `(confirmed ${ADMIN_SYMBOL} ${proj})`,
  ];
  if (project.licensable) {
    facts.push(`(licensable ${proj})`, `(vertical ${proj} ${project.vertical})`);
  }
  return {
    facts,
    note: project.licensable
      ? "With these facts verified-for-skill can hold by project, and reuse-fit can consider the project as reusable IP."
      : "With these facts verified-for-skill can hold by project for each listed skill.",
  };
}
