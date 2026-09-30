/**
 * The one fetch wrapper for the engine API. Every response is parsed with the contract Zod
 * schemas from @venture-route/contracts; the browser never sees an unparsed route and never
 * parses MeTTa output (PRD §5.1). The Clerk bearer header (D-03) is attached only on the
 * guarded marketplace prefixes; routing stays anonymous.
 */
import {
  ChatResponse,
  Ecosystem,
  ValidationErrorResponse,
  VentureBrief,
  VentureRoute,
  type ChatResponse as ChatResponseT,
  type ChatTurnInput,
  type Ecosystem as EcosystemT,
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

/** The engine answered 404: the record does not exist yet (`{"detail": "no profile yet"}`). */
export class ApiNotFoundError extends ApiUnreachableError {
  constructor(message = "The routing engine answered 404.", cause?: unknown) {
    super(message, cause);
    this.name = "ApiNotFoundError";
  }
}

/**
 * The engine refused the action (403) and said why: `reason` is the `detail` string verbatim.
 * For a bid it is the engine's eligibility sentence, which the board and the BidDialog show
 * unchanged (Sprint 004, #67); for a role mismatch it is `role <r> required`.
 */
export class ApiForbiddenError extends ApiUnreachableError {
  readonly reason: string;

  constructor(reason: string, cause?: unknown) {
    super(reason, cause);
    this.name = "ApiForbiddenError";
    this.reason = reason;
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

export type FetchLike = typeof fetch;
export type GetToken = () => Promise<string | null>;
export type Request = <T>(path: string, schema: z.ZodType<T>, init?: RequestInit) => Promise<T>;

/** Only these prefixes carry the Clerk bearer header; /api/route, /api/conversation, /api/scenarios and /health never do. */
const GUARDED_PREFIXES = ["/api/me", "/api/admin", "/api/builders", "/api/requests", "/api/bookings"] as const;

export function needsBearer(path: string): boolean {
  return GUARDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

/** The engine's `{"detail": "…"}` error body, or null when the body has another shape. */
function detailOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail : null;
}

/** JSON POST init for the request helper. */
export function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** JSON PUT init for the request helper (create or replace). */
export function jsonPut(body: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * The one request helper: fetch, attach `authorization: Bearer <token>` on guarded prefixes when
 * a token exists, then parse the body against the contract schema.
 */
export function createRequest(baseUrl: string, fetchLike: FetchLike = fetch, getToken?: GetToken): Request {
  const base = baseUrl.replace(/\/$/, "");

  return async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has("accept")) headers.set("accept", "application/json");
    if (getToken && needsBearer(path)) {
      const token = await getToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
    }
    let response: Response;
    try {
      response = await fetchLike(`${base}${path}`, { ...init, headers });
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
    if (response.status === 404) {
      throw new ApiNotFoundError("The routing engine answered 404.", body);
    }
    const detail = detailOf(body);
    if (response.status === 403 && detail !== null) {
      throw new ApiForbiddenError(detail, body);
    }
    if (!response.ok) {
      const suffix = detail === null ? "" : ` ${detail}`;
      throw new ApiUnreachableError(`The routing engine answered ${response.status}.${suffix}`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiUnreachableError("The routing engine answered outside the contract.", parsed.error);
    }
    return parsed.data;
  };
}

const Scenarios = z.array(VentureBrief);

export function createApiSource(baseUrl: string, fetchLike: FetchLike = fetch, getToken?: GetToken): RouteSource {
  const request = createRequest(baseUrl, fetchLike, getToken);

  return {
    kind: "api",
    getScenarios: () => request("/api/scenarios", Scenarios),
    postRoute: (brief: VentureBriefT): Promise<VentureRouteT> =>
      request("/api/route", VentureRoute, jsonPost(brief)),
    postConversation: (turn: ChatTurnInput): Promise<ChatResponseT> =>
      request("/api/conversation", ChatResponse, jsonPost(turn)),
    getEcosystem: (): Promise<EcosystemT> => request("/api/ecosystem", Ecosystem),
  };
}
