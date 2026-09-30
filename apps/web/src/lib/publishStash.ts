/**
 * The publish stash (Sprint 004, #72): the routing store is in-memory, so a full-page sign-in
 * redirect would lose the brief a visitor just routed. "Sign in to publish" writes the brief and
 * the route to session storage under one key; the route flow reads it back on mount, hydrates
 * the store and clears it. Every storage access is wrapped, so a blocked store (private mode,
 * disabled storage) degrades to a plain sign-in link with no stash. A corrupt stash is ignored
 * and cleared; what comes back is Zod-parsed against the contracts.
 */
import { VentureBrief, VentureRoute } from "@venture-route/contracts";
import { z } from "zod";

export const STASH_KEY = "venture-route:publish-stash";

/** Clerk reads `redirect_url` and returns the visitor to the route flow after sign-in. */
export const SIGN_IN_TO_PUBLISH = "/sign-in?redirect_url=%2Froute";

const Stash = z.object({ brief: VentureBrief, route: VentureRoute });
export type PublishStash = z.infer<typeof Stash>;

function storage(): Storage | null {
  try {
    const store = window.sessionStorage;
    // A getter that throws, or a store that refuses reads, means "no stash".
    store.getItem(STASH_KEY);
    return store;
  } catch {
    return null;
  }
}

/** True when session storage can be read and written from this document. */
export function stashAvailable(): boolean {
  return storage() !== null;
}

/** Writes the stash; false when storage is blocked or full, so the caller can degrade. */
export function writeStash(stash: PublishStash): boolean {
  const store = storage();
  if (store === null) return false;
  try {
    store.setItem(STASH_KEY, JSON.stringify(stash));
    return true;
  } catch {
    return false;
  }
}

/** Reads and validates the stash, or null; a corrupt stash is cleared. */
export function readStash(): PublishStash | null {
  const store = storage();
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(STASH_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = Stash.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // unreadable JSON: treated as corrupt below
  }
  clearStash();
  return null;
}

export function clearStash(): void {
  try {
    window.sessionStorage.removeItem(STASH_KEY);
  } catch {
    // nothing to clear when storage is blocked
  }
}
