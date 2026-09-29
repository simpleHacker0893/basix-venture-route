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
 * One quoted MeTTa string atom, porting `app/engine/projection.py::metta_string` exactly (same
 * escape table, same `\u{hex}` form for every Unicode Cc/Cf/Zl/Zp character, same U+FFFD
 * replacement for NUL and a lone surrogate) so the preview can never diverge from the fact the
 * engine actually projects.
 */
const METTA_ESCAPES = new Map<string, string>([
  ["\\", "\\\\"],
  ['"', '\\"'],
  ["\n", "\\n"],
  ["\r", "\\r"],
  ["\t", "\\t"],
]);
/** Cc (control), Cf (format), Zl (line separator), Zp (paragraph separator). */
const HEX_ESCAPED_CATEGORY = /^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]$/u;
const REPLACEMENT_CHAR = "�";

/** A code point `for...of` could not pair into a surrogate pair: a lone surrogate. */
function isLoneSurrogate(char: string): boolean {
  if (char.length !== 1) return false;
  const code = char.charCodeAt(0);
  return code >= 0xd800 && code <= 0xdfff;
}

export function mettaString(text: string): string {
  const out: string[] = [];
  for (const char of text) {
    const escape = METTA_ESCAPES.get(char);
    if (escape !== undefined) {
      out.push(escape);
    } else if (char === "\u0000" || isLoneSurrogate(char)) {
      out.push(REPLACEMENT_CHAR);
    } else if (HEX_ESCAPED_CATEGORY.test(char)) {
      out.push(`\\u{${(char.codePointAt(0) ?? 0).toString(16)}}`);
    } else {
      out.push(char);
    }
  }
  return `"${out.join("")}"`;
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
