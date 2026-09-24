/**
 * Every English word Chloe speaks, templated only from `ChatResponse` / `VentureRoute` via the
 * labels in `lib/brief.ts` and the formats in `lib/format.ts` (requirements.md §In scope 2,
 * §Business rules; blueprint.md `chloe/script.ts`, "Spoken text" table). Pure functions, no
 * React, no provider calls: Chloe never sets or infers the route status here (AGENTS.md rules
 * 1-3).
 */
import type { BriefField, PartialBriefInput, VentureRoute } from "@venture-route/contracts";

import { FIELD_LABELS, MODE_LABELS, SKILL_LABELS, VERTICAL_LABELS } from "../lib/brief";
import { dateRange, STATUS_LABEL, usd } from "../lib/format";
import { splitFieldMessages } from "../lib/validationError";
import type { VoiceErrorCode } from "../voice/provider";

export const GREETING =
  "Hi, I'm Chloe, Venture Route's assistant. Hold the mic, tell me about your MVP, and let go " +
  "when you're done. I'll ask for anything that's missing.";

function joinWithAnd(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** One question per `BriefField` (except `id`, which the founder never speaks). */
export const QUESTIONS: Record<Exclude<BriefField, "id">, string> = {
  title: "First, what are you building? One line is enough.",
  vertical: "Which vertical is it for: health, agri, or education?",
  requiredSkills: `Which skills do you need? You can pick from ${joinWithAnd(Object.values(SKILL_LABELS))}.`,
  maximumTeamSize: "How many builders at most? Anywhere from one to five.",
  availabilityStart: "When should the engagement start? A date is perfect.",
  availabilityEnd: "And when should it end?",
  deliveryMode: "How will the team work: remote, hybrid, or on-site?",
  location: "Which town or city is the on-site work in?",
  dailyBudget: "What's your budget in US dollars per day?",
  preferReusableIp: "Should I look for reusable IP you could build on? Yes or no.",
};

/** `id` never has a question; every other `BriefField` maps to `QUESTIONS`. */
export function questionFor(field: BriefField): string {
  return field === "id" ? "" : QUESTIONS[field];
}

/**
 * Read the brief back once every required field is filled (requirements.md §In scope 5).
 * Precondition: `missingFields(brief)` is empty; the non-null assertions below rely on it.
 */
export function readBack(brief: PartialBriefInput): string {
  const skills = (brief.requiredSkills ?? []).map((id) => SKILL_LABELS[id]).join(", ");
  const onSite =
    brief.deliveryMode === "on-site" && brief.location ? ` in ${brief.location}` : "";
  const reusable = brief.preferReusableIp ? "preferred" : "not needed";
  return (
    `Here's your brief so far. ${brief.title}, in ${VERTICAL_LABELS[brief.vertical!]}. ` +
    `Skills: ${skills}. Up to ${brief.maximumTeamSize} builders. ` +
    `${dateRange(brief.availabilityStart ?? "", brief.availabilityEnd ?? "")}. ` +
    `${MODE_LABELS[brief.deliveryMode!]}${onSite}. Budget ${usd(brief.dailyBudget ?? 0)}. ` +
    `Reusable IP ${reusable}.`
  );
}

export const CONFIRM_PROMPT =
  "Shall I find your route? Say yes or go ahead, or say no if you'd like to change something first.";
export const CONFIRM_YES_REPLY = "Finding your route.";
export const CONFIRM_NO_REPLY = "No problem. Tell me what to change, or edit it in the brief panel.";

/** Status, summary, each gap, then a pointer to the on-screen route (requirements.md §In scope 6). */
export function speakRoute(route: VentureRoute): string[] {
  const lines: string[] = [`Your route is ${STATUS_LABEL[route.status]}.`, route.summary];
  for (const gap of route.gaps) {
    lines.push(`There's a ${gap.category} gap: ${gap.statement} You could ${gap.nextActions.join("; or ")}.`);
  }
  lines.push("The full route is on screen, with the evidence behind each choice.");
  return lines;
}

export const OFFLINE_ASSISTANT =
  "Heads up: the assistant behind me is offline right now, so I can't understand free speech. " +
  "The mic still works as dictation, what you say lands in the reply box for you to edit, or " +
  "use the form instead.";

export const UNREACHABLE =
  "I can't reach the routing engine right now. Use the form instead, or try again in a moment.";

/** Speaks the engine's field-prefixed validation message using `FIELD_LABELS` (requirements.md §Edge cases). */
export function validationSpoken(message: string): string {
  const fields = Object.keys(FIELD_LABELS);
  const items = splitFieldMessages(message, fields, {});
  const body = items
    .map((item) => {
      const label = FIELD_LABELS[item.field as BriefField];
      return label ? `${label}: ${item.text}` : item.text;
    })
    .join("; ");
  return `The engine found a problem with the brief: ${body}. Fix it in the brief panel or the form.`;
}

export const MIC_ERRORS: Record<VoiceErrorCode, string> = {
  "no-speech": "I didn't catch that. Hold the mic and try again.",
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  network: "Speech recognition needs a network connection.",
  "audio-capture": "I can't find a microphone.",
  aborted: "Let's try that again.",
  unknown: "Let's try that again.",
};

export const UNSUPPORTED_CAPTION = "Voice needs Chrome or Edge.";
export const CONSENT_CAPTION =
  "Voice uses your browser's speech service: Chrome sends your audio to Google for transcription.";

/**
 * Rewrites display text into what should be spoken (requirements.md §Business rules): the
 * on-screen text stored in the `chloe` turn is unchanged.
 */
export function spokenForm(text: string): string {
  return text.replaceAll(" / day", " a day").replaceAll(" – ", " to ").replaceAll("UI/UX", "U I U X");
}
