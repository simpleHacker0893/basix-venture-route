/**
 * Applies the role picked before sign-in (lib/roleIntent.ts) wherever Clerk lands the person:
 * /choose-role, or /route for "Sign in to publish". A signed-in account without a role gets the
 * picked role saved once through the existing `POST /api/me/role`, then Clerk is reloaded. An
 * account that already has a different role keeps it (roles are set once; the engine answers 409)
 * and sees a short note. The intent is cleared either way. A failed save (anything but 409) never
 * navigates away: it shows "We couldn't save your role" with a Try again button. On /choose-role
 * `RoleSelect` owns the save and its own error, so the bridge leaves the pick for it.
 */
import { X } from "lucide-react";
import type { UserRole } from "@venture-route/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useMarketplaceApi } from "../api/marketplaceContext";
import { useAuthState } from "../auth/authContext";
import { ROLE_HOME } from "../auth/config";
import { clearRoleIntent, readRoleIntent } from "../lib/roleIntent";
import { ROLE_SAVE_FAILED, saveRole } from "../lib/saveRole";

const LANDING = ["/choose-role", "/sign-in", "/sign-up"];

export function RoleIntentBridge() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const started = useRef(false);
  const [note, setNote] = useState<string | null>(null);
  const [failedRole, setFailedRole] = useState<UserRole | null>(null);
  const [retrying, setRetrying] = useState(false);

  const save = useCallback(
    async (role: UserRole) => {
      if ((await saveRole(api, role)).kind === "failed") {
        setFailedRole(role);
        return;
      }
      setFailedRole(null);
      await auth.reload();
      if (LANDING.some((path) => pathname.startsWith(path))) navigate(ROLE_HOME[role], { replace: true });
    },
    [api, auth, navigate, pathname],
  );

  useEffect(() => {
    if (!auth.configured || !auth.isLoaded || !auth.isSignedIn || started.current) return;
    if (auth.role === null && pathname.startsWith("/choose-role")) return; // RoleSelect saves it there.
    const intent = readRoleIntent();
    if (intent === null) return;
    started.current = true;
    clearRoleIntent();
    if (auth.role !== null) {
      const role = auth.role;
      if (intent !== "admin" && intent !== role) {
        void Promise.resolve().then(() =>
          setNote(`You picked ${intent}, but this account is already a ${role} account. A role is set once, so you're signed in as a ${role}.`),
        );
      }
      return;
    }
    if (intent === "admin") return; // Admins come from ADMIN_EMAILS; nothing to post.
    void Promise.resolve().then(() => save(intent));
  }, [auth, pathname, save]);

  async function retry() {
    if (failedRole === null) return;
    setRetrying(true);
    await save(failedRole);
    setRetrying(false);
  }

  if (failedRole !== null) {
    return (
      <div role="alert" className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-[14px] leading-relaxed text-white shadow-card lg:bottom-6">
        <span className="flex-1">{ROLE_SAVE_FAILED}</span>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="h-9 rounded-xl bg-accent-green px-4 font-semibold text-white hover:bg-accent-green-hover disabled:opacity-70"
        >
          {retrying ? "Trying…" : "Try again"}
        </button>
      </div>
    );
  }
  if (!note) return null;
  return (
    <div role="status" aria-label="Role note" className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-ink px-5 py-4 text-[14px] leading-relaxed text-white shadow-card lg:bottom-6">
      <span className="flex-1">{note}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setNote(null)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#cfd8d3] hover:bg-white/10"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
