/**
 * The split sign-in shell (design/refined-ui auth screens): a deep-forest panel with the mark, the
 * promise and the step progress, and the working area on paper. The steps follow the flow: choose
 * the one-time role (D-03, D-54), sign in with Clerk, then set up. On phones the panel collapses
 * into a header with the steps in a row.
 */
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { LogoMark } from "../../components/Logo";

const AUTH_STEPS = ["Choose role", "Sign in", "Set up"] as const;

type AuthShellProps = Readonly<{
  /** 1-based index into AUTH_STEPS. */
  step: 1 | 2 | 3;
  children: ReactNode;
}>;

function StepDot({ state }: Readonly<{ state: "done" | "current" | "todo" }>) {
  if (state === "done") {
    return (
      <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full border-2 border-accent-on-dark">
        <Check className="h-2.5 w-2.5 text-accent-on-dark" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={
        state === "current"
          ? "h-4 w-4 rounded-full bg-accent-on-dark ring-4 ring-accent-on-dark/20"
          : "h-4 w-4 rounded-full border-2 border-[#a7b8b0]/60"
      }
    />
  );
}

function Steps({ step, layout }: Readonly<{ step: number; layout: "column" | "row" }>) {
  const row = layout === "row";
  return (
    <ol aria-label="Sign-in progress" className={row ? "flex items-center gap-2" : "flex flex-col"}>
      {AUTH_STEPS.map((label, index) => {
        const position = index + 1;
        const state = position < step ? "done" : position === step ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={row ? "flex min-w-0 flex-1 items-center gap-2 last:flex-none" : "flex flex-col"}
          >
            <span className="flex items-center gap-3">
              <StepDot state={state} />
              <span
                className={`whitespace-nowrap text-[14px] ${state === "current" ? "font-semibold text-[#f3f1ea]" : "text-[#a7b8b0]"}`}
              >
                {label}
              </span>
            </span>
            {index < AUTH_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={
                  row
                    ? `h-px min-w-4 flex-1 ${position < step ? "bg-accent-on-dark" : "bg-border-dark"}`
                    : `ml-[7px] h-7 w-px ${position < step ? "bg-accent-on-dark" : "bg-border-dark"}`
                }
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function AuthShell({ step, children }: AuthShellProps) {
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
        <div className="w-full max-w-[640px]">{children}</div>
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
