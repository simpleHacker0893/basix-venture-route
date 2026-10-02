/**
 * The one-time `POST /api/me/role`, shared by `RoleIntentBridge` and `RoleSelect`. A 409 means the
 * role was already set (elsewhere or by an earlier try); anything else is a failure the screen
 * must show and let the person retry, never navigate past.
 */
import type { UserRole } from "@venture-route/contracts";

import { ApiStatusError } from "../api/client";
import type { MarketplaceApi } from "../api/marketplace";

export const ROLE_SAVE_FAILED = "We couldn't save your role. Please try again.";

export type SaveRoleResult = Readonly<{ kind: "saved" } | { kind: "conflict"; message: string } | { kind: "failed" }>;

export async function saveRole(api: Pick<MarketplaceApi, "postRole">, role: UserRole): Promise<SaveRoleResult> {
  try {
    await api.postRole({ role });
    return { kind: "saved" };
  } catch (cause) {
    const status = cause instanceof ApiStatusError ? cause.status : null;
    // Older callers and fakes throw a plain error whose message carries the code.
    const message = cause instanceof Error ? cause.message : "";
    const conflict = status === 409 || (cause instanceof Error && message.includes("answered 409"));
    if (conflict) return { kind: "conflict", message };
    console.error(`POST /api/me/role failed (status ${status ?? "unknown"})`, cause);
    return { kind: "failed" };
  }
}
