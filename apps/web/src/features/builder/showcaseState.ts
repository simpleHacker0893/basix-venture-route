/**
 * What a builder's showcase entry looks like to the builder (My showcase). Pure functions over the
 * rows the engine already returns, so every state is testable without a screen. Nothing here
 * decides visibility: the engine's one public predicate (showcased, showcase confirmed, project
 * confirmed, owner confirmed) is only mirrored to explain the state in plain words.
 */
import type { AccountStatus, ShowcaseEditInput, ShowcaseProject } from "@venture-route/contracts";

export type ShowcaseCardState =
  | "draft" // not sent to BASIX
  | "waiting" // sent, awaiting BASIX
  | "live" // public now
  | "approved-account" // approved, but the owner's account is not confirmed yet
  | "approved-project" // approved, but the project itself is not confirmed yet
  | "needs-changes"; // BASIX sent it back

export function showcaseCardState(project: ShowcaseProject, account: AccountStatus | null): ShowcaseCardState {
  if (project.showcaseStatus === "rejected") return "needs-changes";
  if (project.showcaseStatus === "pending") return "waiting";
  if (project.showcaseStatus === "confirmed" && project.showcased) {
    if (account !== "confirmed") return "approved-account";
    if (project.status !== "confirmed") return "approved-project";
    return "live";
  }
  return "draft";
}

export type CardCopy = Readonly<{
  pill: string;
  why: string;
}>;

/** Pill text and the plain "why" line for each state. */
export function cardCopy(state: ShowcaseCardState, account: AccountStatus | null): CardCopy {
  switch (state) {
    case "draft":
      return { pill: "Draft", why: "Only you can see this. Turn on Show on Showcase to send it to BASIX." };
    case "waiting":
      return {
        pill: "Waiting for review",
        why:
          account === "confirmed"
            ? "Not public yet. BASIX is reviewing this project."
            : "Not public yet. BASIX confirms your account first, then this project.",
      };
    case "live":
      return { pill: "Live", why: "Visible to everyone on the public Showcase. Editing it sends it back to review." };
    case "approved-account":
      return { pill: "Approved", why: "Approved. Goes live once your account is confirmed." };
    case "approved-project":
      return { pill: "Approved", why: "Approved. Goes live once this project is confirmed." };
    case "needs-changes":
      return { pill: "Needs changes", why: "BASIX sent this back. Update it and publish again." };
  }
}

/** The three counters; an entry that needs changes gets its own, shown only when there is one. */
export function countStates(states: readonly ShowcaseCardState[]) {
  const count = (wanted: readonly ShowcaseCardState[]) => states.filter((s) => wanted.includes(s)).length;
  return {
    live: count(["live"]),
    waiting: count(["waiting", "approved-account", "approved-project"]),
    draft: count(["draft"]),
    needsChanges: count(["needs-changes"]),
  };
}

/**
 * The full `PUT .../showcase` body for the project as it is saved now, with `showcased` set.
 * The engine overwrites every field on each call, so Publish and Withdraw must send the saved
 * description and links back unchanged or they would be wiped.
 */
export function showcaseBody(project: ShowcaseProject, showcased: boolean): ShowcaseEditInput {
  return {
    description: project.description,
    liveUrl: project.liveUrl,
    demoUrl: project.demoUrl,
    pitchVideoUrl: project.pitchVideoUrl,
    pitchDeckUrl: project.pitchDeckUrl,
    showcased,
  };
}

/** Only web links become anchors; the engine validates too, this keeps a stray scheme inert. */
export function isWebUrl(url: string | null): url is string {
  return url !== null && /^https?:\/\//i.test(url);
}

export type SavedLink = Readonly<{ label: string; href: string }>;

export function savedLinks(project: ShowcaseProject): SavedLink[] {
  const links: [string, string | null][] = [
    ["Project link", project.liveUrl],
    ["Demo link", project.demoUrl],
    ["YouTube pitch", project.pitchVideoUrl],
    ["Pitch deck", project.pitchDeckUrl],
  ];
  return links.flatMap(([label, href]) => (isWebUrl(href) ? [{ label, href }] : []));
}
