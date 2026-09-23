/**
 * Screen 2, replicated from the Stitch export design/stitch/batch-2/sign-in (D-36): the metadata
 * eyebrow, the "Welcome back" card whose body is Clerk's prebuilt component, the "Select intent"
 * founder / builder cards, the confirmation footnote and the anonymous-routing link. Omitted
 * embellishments (ledger versions, signer, node and TLS labels, "Live Gateway", the SSO note) are
 * listed in the sprint report; they would assert capabilities the product lacks (AGENTS.md 10).
 * The export's Ledger badge in the header is the shared TopNav's "BASIX Edition" badge.
 */
import { SignIn, SignUp } from "@clerk/react";
import { Link, useLocation } from "react-router";

import { useAuthState, useClerkMounted } from "../../auth/authContext";
import { NotConfiguredPanel } from "./NotConfiguredPanel";
import { clerkAppearance } from "./clerkAppearance";

const INTENTS = [
  {
    role: "founder",
    label: "I am a founder",
    body: "Post requests, inspect deterministic rules, and book interviews.",
  },
  {
    role: "builder",
    label: "I am a builder",
    body: "Verified profile, showcase projects, bid on requests.",
  },
] as const;

export function SignInScreen() {
  const { pathname } = useLocation();
  const mode = pathname.startsWith("/sign-up") ? "sign-up" : "sign-in";
  const auth = useAuthState();
  const clerkMounted = useClerkMounted();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 py-12">
      {/* Top metadata eyebrow */}
      <div className="mb-8 flex items-center gap-3">
        <span className="rounded-pill border border-border bg-surface px-2 py-0.5 text-[13px] text-ink-2">
          BASIX Edition
        </span>
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border-strong" />
        <span className="text-[13px] text-ink-3">Demo data</span>
      </div>

      {/* Main sign-in card */}
      <section aria-labelledby="sign-in-heading" className="w-full max-w-[480px] rounded-lg border border-border bg-surface-strong p-8 shadow-sm">
        <div className="flex flex-col text-left">
          <h1 id="sign-in-heading" className="font-display text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">
            {mode === "sign-up" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
            Founders and builders sign in here. Public registry routing does not require an account.
          </p>
        </div>
        <div className="mt-6 flex w-full flex-col items-center">
          {!auth.configured ? (
            <div className="w-full">
              <NotConfiguredPanel />
            </div>
          ) : !clerkMounted ? (
            /* An injected auth state (tests) has no Clerk provider to mount the prebuilt form. */
            <p className="text-sm text-ink-muted">Sign-in form</p>
          ) : (
            mode === "sign-up" ? (
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
            )
          )}
        </div>
      </section>

      {/* Under-the-card account intent selection */}
      <div className="mt-8 flex w-full max-w-[560px] flex-col items-center">
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-ink-3">New to Venture Route?</span>
            <span aria-hidden="true" className="text-border-strong">/</span>
            <span className="font-medium text-ink">Select intent</span>
          </div>
          <span className="text-[13px] text-ink-3">Deterministic routing</span>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {INTENTS.map((intent) => (
            <Link
              key={intent.role}
              to="/sign-up"
              className="group rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[15px] font-medium text-ink">{intent.label}</span>
              <p className="mt-2 text-[13px] leading-snug text-ink-2">{intent.body}</p>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-center text-[13px] text-ink-3">
          Accounts are confirmed by a <span className="font-medium text-ink-2">BASIX ecosystem admin</span> before
          they appear in public routes or evaluation graphs.
        </p>
        <div className="mt-6 flex items-center gap-3 text-[13px] text-ink-3">
          <span>Need emergency routing without login?</span>
          <Link to="/route" className="font-medium text-accent-green hover:underline">
            Route without an account
          </Link>
        </div>
      </div>
    </div>
  );
}
