/**
 * The Clerk Backend API calls the suite makes (create / find / delete test users) and the
 * self-signed Svix `user.created` event that drives the engine's ADMIN_EMAILS bootstrap
 * (services/engine/app/auth/webhook.py: HMAC-SHA256 over `id.timestamp.body`, `v1,<base64>`).
 * Error messages carry the status and body, never the key.
 */
import { createHmac, randomUUID } from "node:crypto";

import type { TestUser } from "./env";

const CLERK_API = "https://api.clerk.com/v1";

async function clerkFetch(secretKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function fail(step: string, response: Response): Promise<never> {
  throw new Error(`Clerk Backend API ${step} answered ${response.status}: ${await response.text()}`);
}

type ClerkUser = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string }[];
};

export async function createTestUser(secretKey: string, email: string, firstName: string): Promise<TestUser> {
  const response = await clerkFetch(secretKey, "/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      first_name: firstName,
      last_name: "E2E",
      skip_password_requirement: true,
      skip_password_checks: true,
    }),
  });
  if (!response.ok) await fail("POST /users", response);
  const user = (await response.json()) as ClerkUser;
  const address =
    user.email_addresses.find((entry) => entry.id === user.primary_email_address_id) ?? user.email_addresses[0];
  if (!address) throw new Error(`Clerk returned user ${user.id} without an email address`);
  return { id: user.id, email: address.email_address, emailAddressId: address.id };
}

export async function findUserIds(secretKey: string, email: string): Promise<string[]> {
  const response = await clerkFetch(secretKey, `/users?email_address=${encodeURIComponent(email)}`);
  if (!response.ok) await fail("GET /users", response);
  const users = (await response.json()) as ClerkUser[];
  return users.map((user) => user.id);
}

export async function deleteUser(secretKey: string, id: string): Promise<void> {
  const response = await clerkFetch(secretKey, `/users/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) await fail(`DELETE /users/${id}`, response);
}

/** `svix-id`, `svix-timestamp`, `svix-signature` for a body, exactly as Clerk signs them. */
export function svixHeaders(secret: string, body: string, now = Date.now()): Record<string, string> {
  const id = `msg_${randomUUID().replace(/-/g, "")}`;
  const timestamp = String(Math.floor(now / 1000));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

export type WebhookAnswer = { handled: boolean; clerk_id?: string; role?: string; confirmed?: boolean };

/** POST a `user.created` event for `user` to the engine, signed with the suite's test secret. */
export async function postUserCreated(engineUrl: string, secret: string, user: TestUser): Promise<WebhookAnswer> {
  const body = JSON.stringify({
    type: "user.created",
    data: {
      id: user.id,
      primary_email_address_id: user.emailAddressId,
      email_addresses: [{ id: user.emailAddressId, email_address: user.email }],
      public_metadata: {},
    },
  });
  const response = await fetch(`${engineUrl}/api/webhooks/clerk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...svixHeaders(secret, body) },
    body,
  });
  if (!response.ok) {
    throw new Error(`POST /api/webhooks/clerk answered ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as WebhookAnswer;
}
