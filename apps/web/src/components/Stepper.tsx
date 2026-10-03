/**
 * One stepper for every "where am I" strip: the sign-in steps (Choose role, Sign in, Set up) and the
 * builder's account steps on Home. Each step is in exactly one state, and the state is also written
 * in text for screen readers (never colour alone):
 *   done      → filled check
 *   current   → filled number with a ring (aria-current="step")
 *   review    → amber clock: the step is with BASIX
 *   rejected  → cross: BASIX did not confirm this step
 *   locked    → lock: not available yet
 *   upcoming  → grey number
 * `layout` is "row" (circles in a row, labels under), "column" (circles stacked, labels beside) or
 * "responsive" (a column on phones, a row from `md` up). `tone` picks the light or the dark surface.
 */
import { Check, Clock3, Lock, X } from "lucide-react";
import type { ReactNode } from "react";

export type StepState = "done" | "current" | "review" | "rejected" | "locked" | "upcoming";

export type StepperStep = Readonly<{
  label: string;
  /** One short line under the label (Home's account steps). */
  hint?: ReactNode;
  state: StepState;
  /** Small text pill next to the label, e.g. "In review". */
  pill?: string;
}>;

type StepperProps = Readonly<{
  steps: readonly StepperStep[];
  ariaLabel: string;
  layout?: "row" | "column" | "responsive";
  tone?: "light" | "dark";
  size?: "sm" | "md";
}>;

const STATE_WORD: Record<StepState, string> = {
  done: "done",
  current: "current step",
  review: "in review",
  rejected: "not confirmed",
  locked: "locked",
  upcoming: "upcoming",
};

function markerClass(state: StepState, tone: "light" | "dark"): string {
  if (tone === "dark") {
    if (state === "done") return "border-accent-on-dark bg-accent-on-dark text-dark";
    if (state === "current") return "border-accent-on-dark bg-transparent text-accent-on-dark ring-4 ring-accent-on-dark/20";
    return "border-[#a7b8b0]/60 text-[#a7b8b0]";
  }
  if (state === "done") return "border-accent-green bg-accent-green text-white";
  if (state === "current") return "border-accent-green bg-surface-strong text-accent-green ring-4 ring-accent-green/15";
  if (state === "review") return "border-amber-ink bg-amber-fill text-amber-ink";
  if (state === "rejected") return "border-danger bg-danger-tint text-danger";
  return "border-border-strong bg-surface-strong text-ink-3";
}

function labelClass(state: StepState, tone: "light" | "dark"): string {
  if (tone === "dark") return state === "current" ? "font-semibold text-[#f3f1ea]" : "text-[#a7b8b0]";
  return state === "done" || state === "current" || state === "review" || state === "rejected" ? "font-semibold text-ink" : "text-ink-3";
}

export function Stepper({ steps, ariaLabel, layout = "column", tone = "light", size = "md" }: StepperProps) {
  const dot = size === "sm" ? "h-6 w-6 text-[12px]" : "h-9 w-9 text-[14px]";
  const icon = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const responsive = layout === "responsive";
  const row = layout === "row";
  const lineOn = tone === "dark" ? "bg-accent-on-dark" : "bg-accent-green";
  const lineOff = tone === "dark" ? "bg-border-dark" : "bg-border";

  return (
    <ol
      aria-label={ariaLabel}
      className={row ? "flex items-start" : responsive ? "flex flex-col md:flex-row" : "flex flex-col"}
    >
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const filled = step.state === "done";
        return (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className={
              row
                ? `flex min-w-0 flex-col gap-2 ${last ? "" : "flex-1"}`
                : responsive
                  ? "flex gap-3.5 md:min-w-0 md:flex-1 md:flex-col md:gap-3"
                  : "flex gap-3"
            }
          >
            {/* The marker and the line to the next step. */}
            <span
              className={
                row
                  ? "flex items-center"
                  : responsive
                    ? "flex flex-col items-center md:w-full md:flex-row"
                    : "flex flex-col items-center"
              }
            >
              <span
                aria-hidden="true"
                className={`grid shrink-0 place-items-center rounded-full border-2 font-semibold ${dot} ${markerClass(step.state, tone)}`}
              >
                {step.state === "done" ? (
                  <Check className={icon} strokeWidth={3} />
                ) : step.state === "review" ? (
                  <Clock3 className={icon} />
                ) : step.state === "rejected" ? (
                  <X className={icon} strokeWidth={3} />
                ) : step.state === "locked" ? (
                  <Lock className={icon} />
                ) : (
                  index + 1
                )}
              </span>
              {last ? null : (
                <span
                  aria-hidden="true"
                  className={
                    row
                      ? `ml-2 mr-2 h-[2px] flex-1 ${filled ? lineOn : lineOff}`
                      : responsive
                        ? `min-h-5 w-[2px] flex-1 md:ml-3 md:h-[2px] md:min-h-0 md:w-auto ${filled ? lineOn : lineOff}`
                        : `my-1 min-h-5 w-[2px] flex-1 ${filled ? lineOn : lineOff}`
                  }
                />
              )}
            </span>
            <span className={`flex min-w-0 flex-col gap-0.5 ${last || row ? "" : "pb-4 md:pb-0"} ${row ? "" : "pt-1"}`}>
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-[14px] sm:text-[15px] ${labelClass(step.state, tone)}`}>{step.label}</span>
                {step.pill ? (
                  <span className="rounded-pill bg-amber-fill px-2.5 py-0.5 text-[12px] font-medium text-amber-ink">{step.pill}</span>
                ) : null}
                <span className="sr-only">{STATE_WORD[step.state]}</span>
              </span>
              {step.hint ? <span className="text-[13px] leading-snug text-ink-3">{step.hint}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
