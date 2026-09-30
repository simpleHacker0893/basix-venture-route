/**
 * The seed ecosystem the footer's Partners page shows (#79): partners with the verticals they
 * support, universities with their cohorts, and the licensable assets `reuse-fit` can pick.
 * Mirrors `services/engine/app/models/ecosystem.py` (EngineModel, so plain objects); the parity test keeps the two equal.
 */
import { z } from "zod";

import { Vertical } from "./brief.js";

export const EcosystemPartner = z.object({
  partnerId: z.string(),
  verticals: z.array(Vertical),
});
export type EcosystemPartner = z.infer<typeof EcosystemPartner>;

export const EcosystemUniversity = z.object({
  universityId: z.string(),
  cohorts: z.array(z.string()),
});
export type EcosystemUniversity = z.infer<typeof EcosystemUniversity>;

export const EcosystemAsset = z.object({
  assetId: z.string(),
  title: z.string(),
  vertical: Vertical,
});
export type EcosystemAsset = z.infer<typeof EcosystemAsset>;

export const Ecosystem = z.object({
  partners: z.array(EcosystemPartner),
  universities: z.array(EcosystemUniversity),
  assets: z.array(EcosystemAsset),
  /** Every seed entity is fictional (AGENTS.md rule 5). */
  demoData: z.boolean().default(true),
});
export type Ecosystem = z.infer<typeof Ecosystem>;
