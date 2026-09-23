/**
 * /choose-role: the Stitch "Select intent" founder / builder cards (design/stitch/batch-2/sign-in,
 * D-36) as the one-time role choice after sign-up. The choice is written by the engine through
 * POST /api/me/role into Clerk `publicMetadata.role` (D-03); the Clerk user is then reloaded and
 * the screen moves to the role's home.
 */
import type { UserRole } from "@venture-route/contracts";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { ROLE_HOME } from "../../auth/config";
import { NotConfiguredPanel } from "./NotConfiguredPanel";

const CHOICES: { role: UserRole; label: string; body: string }[] = [
  // Only what ships in Sprint 003: requests, bids and interviews arrive in Sprint 004 (rule 10, D-36).
  { role: "founder", label: "I am a founder", body: "Describe your MVP, get a route decided by inspectable rules, and view confirmed builders." },
  { role: "builder", label: "I am a builder", body: "Verified profile, availability and showcase projects that routes can include." },
];

export function RoleSelect() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [pending, setPending] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!auth.configured) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 py-12">
        <NotConfiguredPanel />
      </div>
    );
  }
  if (!auth.isLoaded) {
    return (
      <p className="mx-auto w-full max-w-[1200px] px-6 py-12 text-sm text-ink-muted" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (!auth.isSignedIn) return <Navigate to="/sign-in" replace />;
  if (auth.role !== null) return <Navigate to={ROLE_HOME[auth.role]} replace />;

  async function choose(role: UserRole) {
    setPending(role);
    setError(null);
    try {
      await api.postRole({ role });
      await auth.reload();
      navigate(ROLE_HOME[role], { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The role could not be saved.");
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-[560px] flex-col items-center">
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-ink-3">New to Venture Route?</span>
            <span aria-hidden="true" className="text-border-strong">/</span>
            <span className="font-medium text-ink">Select intent</span>
          </div>
          <span className="text-[13px] text-ink-3">Deterministic routing</span>
        </div>
        <h1 className="sr-only">Choose your role</h1>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.role}
              type="button"
              disabled={pending !== null}
              onClick={() => void choose(choice.role)}
              className="rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-pressed:border-2 aria-pressed:border-accent-green aria-pressed:bg-surface-strong"
              aria-pressed={pending === choice.role}
            >
              <span className="text-[15px] font-medium text-ink">{choice.label}</span>
              <p className="mt-2 text-[13px] leading-snug text-ink-2">{choice.body}</p>
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-3 w-full rounded-card border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <p className="mt-3 text-center text-[13px] text-ink-3">
          Accounts are confirmed by a <span className="font-medium text-ink-2">BASIX ecosystem admin</span> before
          they appear in public routes or evaluation graphs.
        </p>
      </div>
    </div>
  );
}
