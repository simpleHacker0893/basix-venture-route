/**
 * /sign-in and /sign-up (design/refined-ui "Authenticate"): step 1 of the real flow. A tab pair
 * switches between Clerk's prebuilt sign-in and sign-up, both inside our card; after either,
 * Clerk continues to /choose-role, which sends a user who already has a role straight home.
 * Visitors can still route without an account.
 */
import { SignIn, SignUp } from "@clerk/react";
import { ArrowRight, Lock } from "lucide-react";
import { Link, useLocation } from "react-router";

import { useAuthState, useClerkMounted } from "../../auth/authContext";
import { AuthShell, StepEyebrow } from "./AuthShell";
import { NotConfiguredPanel } from "./NotConfiguredPanel";
import { clerkAppearance } from "./clerkAppearance";

const TABS = [
  { mode: "sign-up", label: "Create account", to: "/sign-up" },
  { mode: "sign-in", label: "Sign in", to: "/sign-in" },
] as const;

export function SignInScreen() {
  const { pathname, search } = useLocation();
  const mode = pathname.startsWith("/sign-up") ? "sign-up" : "sign-in";
  const auth = useAuthState();
  const clerkMounted = useClerkMounted();
  return (
    <AuthShell step={1}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <StepEyebrow step={1} />
          <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px]">
            {mode === "sign-up" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Founders and builders sign in here. You choose your role next.
          </p>
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
          Just exploring?{" "}
          <Link to="/route" className="inline-flex items-center gap-1 font-semibold text-accent-green hover:underline">
            Route without an account
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
