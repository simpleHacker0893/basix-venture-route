/**
 * /sign-in and /sign-up (design/refined-ui), role first (D-54). Step 1 "Who are you?" picks
 * founder or builder, or takes the "BASIX admin? Sign in" link; the pick is remembered for this tab
 * (lib/roleIntent.ts). Step 2 is Clerk's prebuilt sign-in or sign-up inside our card, with the pick
 * shown as a chip that goes back to step 1. After Clerk, `RoleIntentBridge` saves a new account's
 * role once through POST /api/me/role; an existing account keeps its role. Clerk's own sub-paths
 * (factor steps, SSO callback) always show the form. Visitors can still route without an account.
 */
import { SignIn, SignUp } from "@clerk/react";
import type { UserRole } from "@venture-route/contracts";
import { ArrowRight, Lock, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useAuthState, useClerkMounted } from "../../auth/authContext";
import { readRoleIntent, writeRoleIntent, clearRoleIntent, type RoleIntent } from "../../lib/roleIntent";
import { AuthShell, StepEyebrow } from "./AuthShell";
import { NotConfiguredPanel } from "./NotConfiguredPanel";
import { RoleCards } from "./RoleCards";
import { clerkAppearance } from "./clerkAppearance";

const TABS = [
  { mode: "sign-up", label: "Create account", to: "/sign-up" },
  { mode: "sign-in", label: "Sign in", to: "/sign-in" },
] as const;

const INTENT_LABEL: Record<RoleIntent, string> = { founder: "Founder", builder: "Builder", admin: "Admin" };

function ExploreLink() {
  return (
    <>
      Just exploring?{" "}
      <Link to="/route" className="-my-2 inline-flex items-center gap-1 py-2.5 font-semibold text-accent-green hover:underline">
        Route without an account
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </>
  );
}

export function SignInScreen() {
  const { pathname, search, key } = useLocation();
  const navigate = useNavigate();
  const mode = pathname.startsWith("/sign-up") ? "sign-up" : "sign-in";
  const auth = useAuthState();
  const clerkMounted = useClerkMounted();
  const [intent, setIntent] = useState<RoleIntent | null>(readRoleIntent);
  const [selected, setSelected] = useState<UserRole>(intent === "builder" ? "builder" : "founder");
  // Clerk's multi-step sub-paths (/sign-in/factor-one, /sso-callback…) always render the form.
  const atStart = pathname === "/sign-in" || pathname === "/sign-up";

  function choose(next: RoleIntent) {
    writeRoleIntent(next);
    setIntent(next);
  }

  function changeRole() {
    clearRoleIntent();
    setIntent(null);
  }

  /** Step 1's Back: the page the visitor came from, or the landing page on a direct visit. */
  function leave() {
    if (key !== "default") void navigate(-1);
    else void navigate("/");
  }

  if (atStart && intent === null && !auth.isSignedIn) {
    return (
      <AuthShell step={1} onBack={leave}>
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
          <RoleCards selected={selected} onSelect={setSelected} />
          <button
            type="button"
            onClick={() => choose(selected)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-green text-[16px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
          >
            {`Continue as ${selected}`}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[14px] text-ink-2">
            <span>
              <ExploreLink />
            </span>
            <button
              type="button"
              onClick={() => choose("admin")}
              className="-my-2 py-2.5 text-ink-3 hover:text-ink hover:underline"
            >
              BASIX admin? Sign in
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  const heading =
    mode === "sign-up" ? (intent && intent !== "admin" ? `Create your ${intent} account` : "Create your account") : "Welcome back";

  return (
    <AuthShell step={2} onBack={atStart && !auth.isSignedIn ? changeRole : undefined}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StepEyebrow step={2} />
            {intent ? (
              <button
                type="button"
                onClick={changeRole}
                aria-label={`${INTENT_LABEL[intent]}: change role`}
                className="inline-flex h-9 items-center gap-2 rounded-pill bg-sage px-3.5 text-[14px] font-semibold text-accent-green transition-colors hover:bg-credential-tint"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                {INTENT_LABEL[intent]}
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">{heading}</h1>
        </div>

        <section
          aria-label={mode === "sign-up" ? "Create account" : "Sign in"}
          className="flex flex-col gap-5 rounded-2xl border border-border bg-surface-strong p-5 shadow-card sm:p-8"
        >
          <nav aria-label="Account" className="grid grid-cols-2 gap-1 rounded-xl bg-ground p-1">
            {TABS.map((tab) => {
              const active = tab.mode === mode;
              return (
                <Link
                  key={tab.mode}
                  to={`${tab.to}${search}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2.5 text-center text-[15px] transition-colors ${active ? "bg-surface-strong font-semibold text-ink shadow-card" : "font-medium text-ink-3 hover:text-ink"}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex w-full flex-col items-stretch">
            {!auth.configured ? (
              <NotConfiguredPanel />
            ) : !clerkMounted ? (
              /* An injected auth state (tests) has no Clerk provider to mount the prebuilt form. */
              <p className="text-sm text-ink-muted">Sign-in form</p>
            ) : mode === "sign-up" ? (
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/choose-role"
                appearance={clerkAppearance}
              />
            ) : (
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/choose-role"
                appearance={clerkAppearance}
              />
            )}
          </div>
        </section>

        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-2">
          <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
          We never show your contact details without your choice.
        </p>
        <p className="text-[14px] text-ink-2">
          <ExploreLink />
        </p>
      </div>
    </AuthShell>
  );
}
