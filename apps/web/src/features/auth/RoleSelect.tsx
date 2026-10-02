/**
 * /choose-role: where Clerk lands a signed-in account (D-03). With a role picked before sign-in
 * (D-54), this screen saves it itself (the bridge leaves /choose-role to it) and says so; a failed
 * save shows "We couldn't save your role" with Try again instead of moving on. Without one, it is
 * the fallback "Who are you?": a card selects, "Continue as <role>" posts the one-time
 * POST /api/me/role (a second call answers 409), then the Clerk user is reloaded and the screen
 * moves to the role's home. A user who already has a role goes straight home.
 */
import type { UserRole } from "@venture-route/contracts";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { ROLE_HOME } from "../../auth/config";
import { clearRoleIntent, readRoleIntent, readRoleParam, withoutRoleParam } from "../../lib/roleIntent";
import { ROLE_SAVE_FAILED, saveRole } from "../../lib/saveRole";
import { AuthShell, StepEyebrow } from "./AuthShell";
import { NotConfiguredPanel } from "./NotConfiguredPanel";
import { RoleCards } from "./RoleCards";

export function RoleSelect() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  // Session storage first; the ?role= the sign-in redirect carried covers a lost tab (founder or builder only).
  const [pending] = useState(() => {
    const intent = readRoleIntent();
    return intent === "founder" || intent === "builder" ? intent : readRoleParam(search);
  });
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<UserRole>(pending ?? "founder");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentFailed, setIntentFailed] = useState(false);
  const intentStarted = useRef(false);
  const ready = auth.configured && auth.isLoaded && auth.isSignedIn && auth.role === null;

  /** Saves the role picked before sign-in; on failure stays here and offers Try again. */
  async function saveIntent(role: UserRole) {
    setIntentFailed(false);
    if ((await saveRole(api, role)).kind === "failed") {
      setIntentFailed(true);
      return;
    }
    await auth.reload();
    navigate(ROLE_HOME[role], { replace: true });
  }

  // The pick is held in state now; drop ?role= from the address bar.
  useEffect(() => {
    if (readRoleParam(search) !== null) navigate({ pathname, search: withoutRoleParam(search), hash }, { replace: true });
  }, [navigate, pathname, search, hash]);

  useEffect(() => {
    if (!ready || !pending || manual || intentStarted.current) return;
    intentStarted.current = true;
    clearRoleIntent();
    void saveIntent(pending);
    // saveIntent only closes over values that are stable for this mount; the ref guards a repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pending, manual]);

  if (!auth.configured) {
    return (
      <AuthShell step={1}>
        <NotConfiguredPanel />
      </AuthShell>
    );
  }
  if (!auth.isLoaded) {
    return (
      <AuthShell step={1}>
        <p className="text-sm text-ink-muted" aria-live="polite">
          Loading…
        </p>
      </AuthShell>
    );
  }
  if (!auth.isSignedIn) return <Navigate to="/sign-in" replace />;
  if (auth.role !== null) return <Navigate to={ROLE_HOME[auth.role]} replace />;

  if (pending && !manual) {
    return (
      <AuthShell step={3}>
        <div className="flex flex-col gap-4">
          <StepEyebrow step={3} />
          <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">
            Setting up your {pending} account…
          </h1>
          {intentFailed ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-danger/40 bg-danger-tint px-3 py-3 text-sm text-danger">
              <p>{ROLE_SAVE_FAILED}</p>
              <button
                type="button"
                onClick={() => void saveIntent(pending)}
                className="h-10 rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white hover:bg-accent-green-hover"
              >
                Try again
              </button>
            </div>
          ) : (
            <p aria-live="polite" className="text-[15px] leading-relaxed text-ink-2">
              Saving the role you picked. You’ll land on your home in a moment.
            </p>
          )}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="-my-2 w-fit py-2.5 text-[14px] font-semibold text-accent-green hover:underline"
          >
            Choose your role here instead
          </button>
        </div>
      </AuthShell>
    );
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    const result = await saveRole(api, selected);
    if (result.kind !== "saved") {
      // A 409 keeps its own message (the role was set elsewhere); any other failure gets the retry wording.
      setError(result.kind === "conflict" ? result.message : ROLE_SAVE_FAILED);
      setSaving(false);
      return;
    }
    await auth.reload();
    navigate(ROLE_HOME[selected], { replace: true });
  }

  return (
    <AuthShell step={1}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <StepEyebrow step={1} />
          <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[48px]">
            Who are you?
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
            Pick how you’ll use Venture Route. Your role is set once, so choose the one that fits.
          </p>
        </div>

        <RoleCards selected={selected} onSelect={setSelected} disabled={saving} />

        {error ? (
          <p role="alert" className="rounded-card border border-danger/40 bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void confirm()}
          disabled={saving}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-green text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover disabled:opacity-70"
        >
          {saving ? "Saving…" : error ? "Try again" : `Continue as ${selected}`}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>

        <p className="text-[13px] leading-relaxed text-ink-3">
          Accounts are confirmed by a <span className="font-medium text-ink-2">BASIX admin</span> before they appear in
          routes or bids.
        </p>
      </div>
    </AuthShell>
  );
}
