/**
 * /choose-role (design/refined-ui "Who are you?"): step 2, the one-time role choice after
 * sign-up. The chosen card is written by the engine through POST /api/me/role into Clerk
 * `publicMetadata.role` (D-03); a second call answers 409, so the copy says the role is set once.
 * The Clerk user is then reloaded and the screen moves to the role's home.
 */
import type { UserRole } from "@venture-route/contracts";
import { ArrowRight, Check, Route, Wrench } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { ROLE_HOME } from "../../auth/config";
import { AuthShell, StepEyebrow } from "./AuthShell";
import { NotConfiguredPanel } from "./NotConfiguredPanel";

type Choice = Readonly<{
  role: UserRole;
  label: string;
  body: string;
  points: readonly string[];
  icon: typeof Route;
  tint: string;
}>;

const CHOICES: readonly Choice[] = [
  {
    role: "founder",
    label: "I’m a founder",
    body: "Describe an MVP, get an evidence-backed team.",
    points: ["Describe your MVP in plain words", "See the evidence behind every match", "Publish requests, book interviews"],
    icon: Route,
    tint: "bg-sage text-accent-green",
  },
  {
    role: "builder",
    label: "I’m a builder",
    body: "Get verified once, get routed for what you can prove.",
    points: ["Build one verified profile", "Get routed for proven skills", "Bid on requests, take interviews"],
    icon: Wrench,
    tint: "bg-project-tint text-project",
  },
];

export function RoleSelect() {
  const auth = useAuthState();
  const api = useMarketplaceApi();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<UserRole>("founder");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.configured) {
    return (
      <AuthShell step={2}>
        <NotConfiguredPanel />
      </AuthShell>
    );
  }
  if (!auth.isLoaded) {
    return (
      <AuthShell step={2}>
        <p className="text-sm text-ink-muted" aria-live="polite">
          Loading…
        </p>
      </AuthShell>
    );
  }
  if (!auth.isSignedIn) return <Navigate to="/sign-in" replace />;
  if (auth.role !== null) return <Navigate to={ROLE_HOME[auth.role]} replace />;

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
    <AuthShell step={2}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <StepEyebrow step={2} />
          <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[48px]">
            Who are you?
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
            Pick how you’ll use Venture Route. Your role is set once, so choose the one that fits.
          </p>
        </div>

        <div role="group" aria-label="Role" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHOICES.map((choice) => {
            const active = selected === choice.role;
            const Icon = choice.icon;
            return (
              <button
                key={choice.role}
                type="button"
                aria-pressed={active}
                disabled={saving}
                onClick={() => setSelected(choice.role)}
                className={`relative flex flex-col gap-4 rounded-2xl border bg-surface-strong p-5 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 disabled:opacity-70 sm:p-6 ${active ? "border-2 border-accent-green shadow-[0_0_0_4px_rgba(30,90,69,0.08)]" : "border-border hover:border-border-strong"}`}
              >
                {active ? (
                  <span aria-hidden="true" className="absolute right-5 top-5 grid h-6 w-6 place-items-center rounded-full bg-accent-green">
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </span>
                ) : null}
                <span aria-hidden="true" className={`grid h-12 w-12 place-items-center rounded-xl ${choice.tint}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-display text-[24px] leading-tight text-ink">{choice.label}</span>
                  <span className="text-[15px] leading-relaxed text-ink-2">{choice.body}</span>
                </span>
                <ul className="hidden flex-col gap-2 border-t border-border pt-4 text-[14px] text-ink-2 sm:flex">
                  {choice.points.map((point) => (
                    <li key={point} className="flex items-center gap-2.5">
                      <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-green" />
                      {point}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

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
