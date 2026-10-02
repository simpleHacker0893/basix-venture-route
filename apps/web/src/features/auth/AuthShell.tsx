/**
 * The split sign-in shell (design/refined-ui auth screens): a deep-forest panel with the mark, the
 * promise and the step progress, and the working area on paper. The steps follow the flow: choose
 * the one-time role (D-03, D-54), sign in with Clerk, then set up. The steps are the shared
 * `Stepper` (components/Stepper.tsx): done, current and upcoming. On phones the panel collapses
 * into a header with the steps in a row.
 */
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { LogoMark } from "../../components/Logo";
import { Stepper } from "../../components/Stepper";

const AUTH_STEPS = ["Choose role", "Sign in", "Set up"] as const;

type AuthShellProps = Readonly<{
  /** 1-based index into AUTH_STEPS. */
  step: 1 | 2 | 3;
  /** Shows a Back control above the content; the caller decides where back goes. */
  onBack?: () => void;
  children: ReactNode;
}>;

function Steps({ step, layout }: Readonly<{ step: number; layout: "column" | "row" }>) {
  return (
    <Stepper
      ariaLabel="Sign-in progress"
      layout={layout}
      tone="dark"
      size="sm"
      steps={AUTH_STEPS.map((label, index) => ({
        label,
        state: index + 1 < step ? "done" : index + 1 === step ? "current" : "upcoming",
      }))}
    />
  );
}

export function AuthShell({ step, onBack, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-ground lg:grid lg:grid-cols-[minmax(360px,39%)_1fr]">
      <aside className="flex flex-col gap-6 bg-dark px-5 pb-6 pt-6 text-[#f3f1ea] sm:px-8 lg:min-h-screen lg:justify-between lg:gap-0 lg:px-14 lg:py-12">
        <Link to="/" className="flex items-center gap-3 font-display text-[22px] font-semibold tracking-tight">
          <LogoMark size={34} />
          Venture Route
        </Link>
        <div className="flex flex-col gap-4">
          <span className="hidden font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-on-dark lg:block">
            For the BASIX ecosystem
          </span>
          <p className="font-display text-[34px] leading-[1.05] tracking-[-0.02em] sm:text-[40px] lg:text-[58px]">
            Evidence, not <em className="italic text-accent-on-dark">introductions.</em>
          </p>
          <p className="hidden max-w-sm text-[16px] leading-relaxed text-[#cfd8d3] lg:block">
            Founders get teams they can verify. Builders get routed for what they can prove.
          </p>
        </div>
        <div className="hidden lg:block">
          <Steps step={step} layout="column" />
        </div>
        <div className="lg:hidden">
          <Steps step={step} layout="row" />
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="flex flex-1 justify-center px-5 py-8 outline-none sm:px-8 lg:items-center lg:py-12">
        <div className="flex w-full max-w-[640px] flex-col gap-5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex h-11 w-fit items-center gap-2 rounded-lg px-2 text-[15px] font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </button>
          ) : null}
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}

/** "STEP n OF 3" eyebrow above each auth heading. */
export function StepEyebrow({ step }: Readonly<{ step: number }>) {
  return (
    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
      Step {step} of {AUTH_STEPS.length}
    </span>
  );
}
