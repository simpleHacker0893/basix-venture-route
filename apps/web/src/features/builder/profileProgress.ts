/**
 * Pure helpers for the profile's left rail: which sections have content and the strength count.
 * Strength is only a count of sections that already have content, worked out from fields that exist
 * today (no new fields, nothing sent to the engine): a nudge for the builder, never a signal the
 * routing rules read.
 */

export type ProfileSectionId = "profile-about" | "profile-skills" | "profile-availability" | "profile-modes" | "profile-contact" | "showcase";

export type ProfileSection = Readonly<{ id: ProfileSectionId; label: string; done: boolean; next: string }>;

/** What the rail needs from the form's current values (so it moves as the builder types). */
export type ProfileProgressInput = Readonly<{
  displayName: string;
  headline: string;
  skillCount: number;
  windows: number;
  dayRate: string;
  modes: Readonly<{ remote: boolean; hybrid: boolean; onSite: boolean }>;
  location: string;
  sharing: Readonly<{ email: boolean; phone: boolean; linkedin: boolean }>;
  projects: number;
}>;

export function profileSections(input: ProfileProgressInput): ProfileSection[] {
  const rate = Number(input.dayRate);
  return [
    {
      id: "profile-about",
      label: "About you",
      done: input.displayName.trim() !== "" && input.headline.trim() !== "",
      next: "add your name and headline",
    },
    { id: "profile-skills", label: "Skills", done: input.skillCount > 0, next: "add your skills" },
    {
      id: "profile-availability",
      label: "Availability",
      done: input.windows > 0 && Number.isFinite(rate) && rate > 0,
      next: "add when you are available and your day rate",
    },
    {
      id: "profile-modes",
      label: "Delivery modes",
      done: (input.modes.remote || input.modes.hybrid || input.modes.onSite) && input.location.trim() !== "",
      next: "pick how you can deliver and where you are based",
    },
    {
      id: "profile-contact",
      label: "Contact sharing",
      done: input.sharing.email || input.sharing.phone || input.sharing.linkedin,
      next: "choose what founders may see",
    },
    { id: "showcase", label: "Showcase projects", done: input.projects > 0, next: "add a project to your showcase" },
  ];
}

export function strength(sections: readonly ProfileSection[]) {
  const done = sections.filter((s) => s.done).length;
  return { done, total: sections.length, percent: Math.round((done / sections.length) * 100) };
}
