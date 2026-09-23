/**
 * The one fetch wrapper for the engine API. Every response is parsed with the contract Zod
 * schemas from @venture-route/contracts; the browser never sees an unparsed route and never
 * parses MeTTa output (PRD §5.1).
 */
import {
  ChatResponse,
  ValidationErrorResponse,
  VentureBrief,
  VentureRoute,
  type ChatResponse as ChatResponseT,
  type ChatTurnInput,
  type VentureBrief as VentureBriefT,
  type VentureRoute as VentureRouteT,
} from "@venture-route/contracts";
import { z } from "zod";

import type { RouteSource } from "./source";

/** The engine could not be reached, or answered something outside the contract. */
export class ApiUnreachableError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ApiUnreachableError";
    this.cause = cause;
  }
}

/** The engine rejected the input with the contract's validation-error shape (422). */
export class ApiValidationError extends Error {
  readonly response: z.infer<typeof ValidationErrorResponse>;

  constructor(response: z.infer<typeof ValidationErrorResponse>) {
    super(response.message);
    this.name = "ApiValidationError";
    this.response = response;
  }
}

type FetchLike = typeof fetch;

const Scenarios = z.array(VentureBrief);

export function createApiSource(baseUrl: string, fetchLike: FetchLike = fetch): RouteSource {
  const base = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetchLike(`${base}${path}`, {
        ...init,
        headers: { accept: "application/json", ...(init?.headers ?? {}) },
      });
    } catch (cause) {
      throw new ApiUnreachableError("The routing engine could not be reached.", cause);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ApiUnreachableError("The routing engine answered with something unreadable.", cause);
    }
    if (response.status === 422) {
      const parsed = ValidationErrorResponse.safeParse(body);
      if (parsed.success) throw new ApiValidationError(parsed.data);
    }
    if (!response.ok) {
      throw new ApiUnreachableError(`The routing engine answered ${response.status}.`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiUnreachableError("The routing engine answered outside the contract.", parsed.error);
    }
    return parsed.data;
  }

  const post = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    kind: "api",
    getScenarios: () => request("/api/scenarios", Scenarios),
    postRoute: (brief: VentureBriefT): Promise<VentureRouteT> =>
      request("/api/route", VentureRoute, post(brief)),
    postConversation: (turn: ChatTurnInput): Promise<ChatResponseT> =>
      request("/api/conversation", ChatResponse, post(turn)),
  };
}
