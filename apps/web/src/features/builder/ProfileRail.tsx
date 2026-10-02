/**
 * The profile's left rail: "Profile strength" and a checklist of its sections, each of which
 * scrolls to its card. What counts as done lives in `profileProgress.ts`.
 */
import { Check } from "lucide-react";

import { strength, type ProfileSection } from "./profileProgress";

function scrollTo(id: string) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

export function ProfileRail({ sections }: Readonly<{ sections: readonly ProfileSection[] }>) {
  const { done, total, percent } = strength(sections);
  const firstOpen = sections.find((s) => !s.done);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
      <section aria-label="Profile strength" className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="relative grid h-[72px] w-[72px] shrink-0 place-items-center">
            <svg aria-hidden="true" viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
              <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="7" className="stroke-border" />
              <circle
                cx="36"
                cy="36"
                r={radius}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className="stroke-accent-green"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - done / total)}
              />
            </svg>
            <span className="font-display text-[18px] text-ink">{percent}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-ink">Profile strength</span>
            <span className="text-[13px] text-ink-3">
              {done} of {total} done
            </span>
          </div>
        </div>
        <p className="text-[13px] leading-snug text-ink-3">
          {firstOpen ? `Next: ${firstOpen.next}.` : "Every section has content. Keep it current."}
        </p>
      </section>

      <nav aria-label="Profile sections" className="rounded-card border border-border bg-surface-strong p-2 shadow-card">
        <ul className="flex flex-col">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollTo(section.id);
                }}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${section.done ? "border-accent-green bg-accent-green text-white" : "border-border-strong"}`}
                >
                  {section.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                {section.label}
                <span className="sr-only">{section.done ? "done" : "to do"}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
