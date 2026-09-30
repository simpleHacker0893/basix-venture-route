/**
 * The role picked before signing in (role-first sign-in, D-54). The "Who are you?" step writes it
 * to session storage; once Clerk has signed the person in, `RoleIntentBridge` saves it once through
 * the existing `POST /api/me/role` and clears it. "admin" only records that the admin link was
 * used: admins come from ADMIN_EMAILS through the webhook, so nothing is posted for them. Every
 * storage access is wrapped, like the publish stash: blocked storage means "no intent", and the
 * /choose-role cards remain the fallback.
 */
import type { UserRole } from "@venture-route/contracts";

export const ROLE_INTENT_KEY = "venture-route:role-intent";

export type RoleIntent = UserRole | "admin";

const VALUES: readonly RoleIntent[] = ["founder", "builder", "admin"];

function storage(): Storage | null {
  try {
    const store = window.sessionStorage;
    store.getItem(ROLE_INTENT_KEY);
    return store;
  } catch {
    return null;
  }
}

export function readRoleIntent(): RoleIntent | null {
  const value = storage()?.getItem(ROLE_INTENT_KEY) ?? null;
  return value !== null && (VALUES as readonly string[]).includes(value) ? (value as RoleIntent) : null;
}

export function writeRoleIntent(intent: RoleIntent): void {
  try {
    storage()?.setItem(ROLE_INTENT_KEY, intent);
  } catch {
    // A full or blocked store only means the /choose-role cards are shown after sign-in.
  }
}

export function clearRoleIntent(): void {
  try {
    storage()?.removeItem(ROLE_INTENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
