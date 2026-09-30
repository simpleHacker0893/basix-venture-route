/**
 * The founder / builder cards of "Who are you?" (design/refined-ui), shared by the first sign-in
 * step and the /choose-role fallback. Presentational: the caller owns the selection and what
 * Continue does.
 */
import type { UserRole } from "@venture-route/contracts";
import { Check, Route, Wrench } from "lucide-react";

const CHOICES = [
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
] as const;

export function RoleCards({
  selected,
  onSelect,
  disabled = false,
}: Readonly<{ selected: UserRole; onSelect(role: UserRole): void; disabled?: boolean }>) {
  return (
    <div role="group" aria-label="Role" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CHOICES.map((choice) => {
        const active = selected === choice.role;
        const Icon = choice.icon;
        return (
          <button
            key={choice.role}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(choice.role)}
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
  );
}
