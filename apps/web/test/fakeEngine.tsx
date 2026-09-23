/**
 * A fake of the Sprint 001 engine at the network boundary, answering from the generated
 * snapshot. Only `fetch` is faked; the real client, store and screens run.
 */
import type { ChatResponse, VentureBrief } from "@venture-route/contracts";
import { render } from "@testing-library/react";

import { createApiSource } from "../src/api/client";
import { App } from "../src/App";
import snapshot from "../src/offline/snapshot.json";

export type FetchLike = typeof fetch;

export const SEED_BRIEFS = Object.values(snapshot.briefs) as VentureBrief[];

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The nine founder-facing fields the engine asks for, in PRD §5.3 order. */
export const REQUIRED_FIELDS = [
  "title",
  "vertical",
  "requiredSkills",
  "maximumTeamSize",
  "availabilityStart",
  "availabilityEnd",
  "deliveryMode",
  "dailyBudget",
  "preferReusableIp",
] as const;

const EMPTY_PARTIAL = Object.fromEntries([...REQUIRED_FIELDS, "id", "location", "demoData"].map((f) => [f, null]));

/** The engine's clarification for a message with nothing extractable (NullAdapter). */
export function clarificationFor(partial: Record<string, unknown>): ChatResponse {
  const missing = REQUIRED_FIELDS.filter((f) => partial[f] == null);
  return {
    type: "clarification",
    missingFields: [...missing],
    message: `To route this brief I still need:\n${missing.map((f) => `- ${f}: …`).join("\n")}`,
    partialBrief: { ...EMPTY_PARTIAL, ...partial } as ChatResponse extends { partialBrief: infer P } ? P : never,
  };
}

/** The seed brief whose routing-relevant fields equal the posted brief's (ids may differ). */
function routeForBrief(brief: Record<string, unknown>) {
  const key = (b: Record<string, unknown>) =>
    JSON.stringify([b.vertical, b.requiredSkills, b.deliveryMode, b.location ?? null, b.dailyBudget, b.maximumTeamSize]);
  const wanted = key(brief);
  const match = SEED_BRIEFS.find((seed) => key(seed as unknown as Record<string, unknown>) === wanted);
  if (!match) throw new Error(`fake engine has no route for ${JSON.stringify(brief)}`);
  return snapshot.routes[match.id as keyof typeof snapshot.routes];
}

type Overrides = Partial<Record<"scenarios" | "route" | "conversation", (init?: RequestInit) => Response>>;

export function engineFetch(overrides: Overrides = {}): FetchLike {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/scenarios")) {
      return overrides.scenarios?.(init) ?? jsonResponse(SEED_BRIEFS);
    }
    if (url.endsWith("/api/route")) {
      if (overrides.route) return overrides.route(init);
      return jsonResponse(routeForBrief(JSON.parse(String(init?.body))));
    }
    if (url.endsWith("/api/conversation")) {
      if (overrides.conversation) return overrides.conversation(init);
      const turn = JSON.parse(String(init?.body)) as { userMessage: string; currentBrief?: Record<string, unknown> };
      const current = turn.currentBrief ?? {};
      const complete = REQUIRED_FIELDS.every((f) => current[f] != null);
      if (!complete) return jsonResponse(clarificationFor(current));
      const brief = { ...current, id: current.id ?? "brief-from-chat", demoData: true };
      return jsonResponse({
        type: "route",
        brief,
        route: routeForBrief(brief),
        message: "Here is the route the engine computed for your brief.",
      });
    }
    throw new Error(`unexpected url ${url}`);
  };
}

export function renderApp(path: string, fetchLike: FetchLike = engineFetch()) {
  const source = createApiSource("http://engine.test", fetchLike);
  return render(<App initialPath={path} source={source} />);
}
