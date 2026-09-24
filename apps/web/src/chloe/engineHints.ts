/**
 * Client copies of the orchestrator's fixed strings (Sprint 006 requirements.md §In scope 2,
 * blueprint.md `chloe/engineHints.ts`). Kept byte-identical with
 * `services/engine/app/conversation/orchestrator.py` (FORM_FALLBACK_HINT, ROUTE_MESSAGE,
 * CLARIFICATION_PREFIX). Do not edit the orchestrator from here (D-51): Chloe only reads its
 * output text, she never changes engine behaviour.
 */
import type { ChatResponse } from "@venture-route/contracts";

/** Verbatim copy of `orchestrator.FORM_FALLBACK_HINT`. */
export const FORM_FALLBACK_HINT =
  "The language model is unavailable right now; fill in the structured form and the route " +
  "will be identical.";

/** Verbatim copy of `orchestrator.ROUTE_MESSAGE`. */
export const ROUTE_MESSAGE = "Here is the route the engine computed for your brief.";

/** Verbatim copy of `orchestrator.CLARIFICATION_PREFIX`. */
export const CLARIFICATION_PREFIX = "To route this brief I still need:";

/**
 * True when the response came back from the engine's `NullAdapter` (no `ANTHROPIC_API_KEY`):
 * a clarification message is prefixed with `FORM_FALLBACK_HINT`, a route message equals it.
 */
export function isKeyless(response: ChatResponse): boolean {
  if (response.type === "clarification") return response.message.startsWith(FORM_FALLBACK_HINT);
  if (response.type === "route") return response.message === FORM_FALLBACK_HINT;
  return false;
}
