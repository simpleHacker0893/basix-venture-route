/**
 * ChatTurn and ChatResponse: the conversation seam (PRD §5.2).
 *
 * Mirrors `services/engine/app/models/chat.py`. Exactly one of clarification, route or
 * validation-error comes back from POST /api/conversation.
 */
import { z } from "zod";

import { BriefField, PartialBrief, VentureBrief } from "./brief.js";
import { VentureRoute } from "./route.js";

export const MAX_MESSAGE_LENGTH = 4000;

export const ChatTurn = z.strictObject({
  userMessage: z.string().max(MAX_MESSAGE_LENGTH),
  currentBrief: PartialBrief.nullable().default(null),
});
export type ChatTurn = z.infer<typeof ChatTurn>;
export type ChatTurnInput = z.input<typeof ChatTurn>;

export const ClarificationResponse = z.object({
  type: z.literal("clarification"),
  missingFields: z.array(BriefField),
  message: z.string(),
  partialBrief: PartialBrief,
});
export type ClarificationResponse = z.infer<typeof ClarificationResponse>;

export const RouteResponse = z.object({
  type: z.literal("route"),
  brief: VentureBrief,
  route: VentureRoute,
  message: z.string(),
});
export type RouteResponse = z.infer<typeof RouteResponse>;

export const ValidationErrorResponse = z.object({
  type: z.literal("validation-error"),
  message: z.string(),
});
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponse>;

export const ChatResponse = z.discriminatedUnion("type", [
  ClarificationResponse,
  RouteResponse,
  ValidationErrorResponse,
]);
export type ChatResponse = z.infer<typeof ChatResponse>;
