/**
 * /choose-role: where Clerk lands a signed-in account (D-03). With a role picked before sign-in
 * (D-54), `RoleIntentBridge` is already saving it, so this screen only says so. Without one, it is
 * the fallback "Who are you?": a card selects, "Continue as <role>" posts the one-time
 * POST /api/me/role (a second call answers 409), then the Clerk user is reloaded and the screen
 * moves to the role's home. A user who already has a role goes straight home.
 */
import type { UserRole } from "@venture-route/contracts";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { ROLE_HOME } from "../../auth/config";
import { readRoleIntent } from "../../lib/roleIntent";
import { AuthShell, StepEyebrow } from "./AuthShell";
import { NotConfiguredPanel } from "./NotConfiguredPanel";
import { RoleCards } from "./RoleCards";

export function RoleSelect() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [pending] = useState(() => {
    const intent = readRoleIntent();
    return intent === "founder" || intent === "builder" ? intent : null;
  });
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<UserRole>(pending ?? "founder");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <p aria-live="polite" className="text-[15px] leading-relaxed text-ink-2">
            Saving the role you picked. You’ll land on your home in a moment.
          </p>
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
    try {
      await api.postRole({ role: selected });
      await auth.reload();
      navigate(ROLE_HOME[selected], { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The role could not be saved.");
      setSaving(false);
    }
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
          {saving ? "Saving…" : `Continue as ${selected}`}
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
