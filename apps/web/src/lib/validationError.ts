/**
 * Maps the engine's `validation-error` message to a form field (requirements.md Edge cases):
 * the prefix before the first colon names the field (`dailyBudget: …`); a message without a
 * prefix belongs at the top of the form.
 */
const FIELD_PREFIX = /^([A-Za-z][A-Za-z0-9_.]*):\s*(.*)$/s;

/** Engine field names that the editor renders under a different key. */
const FIELD_ALIASES: Record<string, string> = {
  availabilityStart: "availability",
  availabilityEnd: "availability",
};

export type FieldMessage = { field: string; text: string };

export function splitFieldMessage(message: string): FieldMessage {
  const match = FIELD_PREFIX.exec(message.trim());
  if (!match) return { field: "form", text: message.trim() };
  const [, rawField, text] = match;
  const field = rawField?.split(".")[0] ?? "form";
  return { field: FIELD_ALIASES[field] ?? field, text: text ?? "" };
}

/** Several errors arrive joined by `; ` (one line per engine error). */
export function splitFieldMessages(message: string): FieldMessage[] {
  return message
    .split(/;\s+(?=[A-Za-z][A-Za-z0-9_.]*:)/)
    .map((part) => splitFieldMessage(part))
    .filter((item) => item.text.length > 0);
}
