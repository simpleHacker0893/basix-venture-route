/**
 * The yes/no phrase matcher for Chloe's read-back confirmation (requirements.md §In scope 5,
 * blueprint.md `chloe/confirm.ts`). Pure text matching only; it never decides the route.
 */

export const YES_PHRASES: readonly string[] = ["yes", "go ahead", "do it"];
export const NO_PHRASES: readonly string[] = ["no", "wait", "not yet"];

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(value: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => value === phrase || value.startsWith(`${phrase} `));
}

/**
 * `null` when the utterance is neither a yes nor a no phrase. A phrase matches the whole
 * utterance or its start (so "yes please" matches "yes"), which is why "now" and "not" do not
 * match "no".
 */
export function matchConfirm(text: string): "yes" | "no" | null {
  const value = normalise(text);
  if (matchesAny(value, YES_PHRASES)) return "yes";
  if (matchesAny(value, NO_PHRASES)) return "no";
  return null;
}
