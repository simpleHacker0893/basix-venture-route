/**
 * Applies the role picked before sign-in (lib/roleIntent.ts) wherever Clerk lands the person:
 * /choose-role, or /route for "Sign in to publish". A signed-in account without a role gets the
 * picked role saved once through the existing `POST /api/me/role`, then Clerk is reloaded. An
 * account that already has a different role keeps it (roles are set once; the engine answers 409)
 * and sees a short note. The intent is cleared either way.
 */
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useMarketplaceApi } from "../api/marketplaceContext";
import { useAuthState } from "../auth/authContext";
import { ROLE_HOME } from "../auth/config";
import { clearRoleIntent, readRoleIntent } from "../lib/roleIntent";

const LANDING = ["/choose-role", "/sign-in", "/sign-up"];

export function RoleIntentBridge() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const started = useRef(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.configured || !auth.isLoaded || !auth.isSignedIn || started.current) return;
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
    void (async () => {
      try {
        await api.postRole({ role: intent });
      } catch {
        // 409: the role was set elsewhere; reloading shows it. Anything else leaves /choose-role.
      }
      await auth.reload();
      if (LANDING.some((path) => pathname.startsWith(path))) navigate(ROLE_HOME[intent], { replace: true });
    })();
  }, [auth, api, navigate, pathname]);

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
