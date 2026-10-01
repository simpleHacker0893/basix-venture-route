/**
 * Scene IDs and their on-screen captions. Interim map for the tracer scene (#145); the scene
 * table in the video script (#144) is the source of truth and replaces these entries.
 */
export const SCENES = {
  H1: "Route your MVP to verified builders",
} as const;

export type SceneId = keyof typeof SCENES;
