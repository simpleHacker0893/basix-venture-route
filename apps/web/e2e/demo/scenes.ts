/**
 * Scene IDs, their stable clip names and on-screen captions. The scene table in the video script
 * (`docs/demo/SCRIPT.md`, #144) is the source of truth: the founder scenes' clip names and
 * captions are copied from it verbatim. H1 keeps the caption the #145 tracer recorded.
 */
export const SCENES = {
  H1: { clip: "H1-landing", caption: "Route your MVP to verified builders" },
  F1: { clip: "F1-signup", caption: "A new founder signs up" },
  F2: { clip: "F2-chloe-brief", caption: "She describes her MVP to Chloe" },
  F3: { clip: "F3-chloe-asks", caption: "Chloe asks only for what's missing" },
  F4: { clip: "F4-review", caption: "Review the chips, fix any drift" },
  F5: { clip: "F5-route", caption: "Feasible: three verified builders, USD 370" },
  F6: { clip: "F6-why", caption: "Why this route? Named rules, exact facts" },
  F7: { clip: "F7-change-constraint", caption: "Change a constraint: the gap comes first" },
  F8: { clip: "F8-publish", caption: "Published as a request for builders" },
} as const satisfies Record<string, { clip: string; caption: string }>;

export type SceneId = keyof typeof SCENES;

/**
 * Who a scene is recorded as. Each role keeps one browser context and one page for the whole run
 * (`fixtures.ts`), so the role's in-memory app state (Chloe's conversation, the routed brief)
 * carries from one of its scenes to the next. `visitor` is never signed in.
 */
export type SceneRole = "visitor" | "founder" | "builder" | "admin";
