/**
 * Sign-in and API helpers for the Clerk suite. Sign-in is the `email_code` strategy on a
 * `+clerk_test` address (code 424242, no email sent) through `@clerk/testing`; the role choice
 * goes through the real `/choose-role` screen and `POST /api/me/role` on first sign-in and is
 * skipped by `RequireRole`'s redirect afterwards, so every spec is independent of the others.
 */
import { clerk } from "@clerk/testing/playwright";
import { expect, type APIResponse, type Page } from "@playwright/test";

import { readState, type Role } from "./env";

export const HOME_HEADING: Record<Role, string> = {
  founder: "Describe your MVP",
  builder: "Your profile",
  admin: "Confirmation queue",
};

const ROLE_CARD: Record<Exclude<Role, "admin">, RegExp> = {
  founder: /I am a founder/,
  builder: /I am a builder/,
};

/** Sign in as the run's user for `role`; the page ends on that role's home screen. */
export async function signInAs(page: Page, role: Role): Promise<void> {
  const { users } = readState();
  const user = users[role];
  if (!user) throw new Error(`no ${role} test user in the suite state`);
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: user.email } });
  await page.goto("/choose-role");
  const heading = page.getByRole("heading", { level: 1, name: HOME_HEADING[role] });
  if (role === "admin") {
    // Admin is bootstrapped by the webhook; the cards must never be offered to an admin.
    await expect(heading).toBeVisible();
    return;
  }
  const card = page.getByRole("button", { name: ROLE_CARD[role] });
  await expect(card.or(heading)).toBeVisible();
  if (await card.isVisible()) await card.click();
  await expect(heading).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await clerk.signOut({ page });
}

/** A fresh session JWT from clerk-js (the same token the app's fetch wrapper sends). */
export async function sessionToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.Clerk.session?.getToken({ skipCache: true }));
  if (!token) throw new Error("no Clerk session on the page");
  return token;
}

/** The JWT claims without the signature, for evidence only (no secret inside). */
export function decodeClaims(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * The engine reads the role from the session token's `metadata` claim (D-03). A 403 on the
 * caller's own route with a valid session means the claim is absent from the Clerk session token
 * template: an Operator Dashboard step (Sessions → Customize session token →
 * `{"metadata": "{{user.public_metadata}}"}`), never something this suite works around.
 */
export async function expectRoleClaim(page: Page, ownPath: string): Promise<string> {
  const token = await sessionToken(page);
  const claims = decodeClaims(token);
  const own = await engineGet(page, ownPath, token);
  expect(
    own.status(),
    `session refused on its own route ${ownPath} (${await own.text()}); claims without signature: ${JSON.stringify({ ...claims, sid: undefined })}`,
  ).not.toBe(403);
  return token;
}

export async function engineGet(page: Page, path: string, token?: string): Promise<APIResponse> {
  const { engineUrl } = readState();
  return page.request.get(`${engineUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function enginePost(page: Page, path: string, token: string): Promise<APIResponse> {
  const { engineUrl } = readState();
  return page.request.post(`${engineUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}
