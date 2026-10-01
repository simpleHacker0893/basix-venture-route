/**
 * Playwright with Clerk test users (Sprint 003 #47): the three-role smoke and the
 * confirm-then-route flow. Runs locally only; CI keeps the no-key `playwright.config.ts` suite
 * (D-33). Servers: the engine on the compose `db` with LLM_PROVIDER=null, a per-run Svix test
 * secret and ADMIN_EMAILS set to the run's admin address (port 8001), and a production build
 * with the real VITE_CLERK_PUBLISHABLE_KEY from the repo-root .env served by vite preview on
 * 4175. Both ports differ from the no-key suite's so the two never reuse each other's servers.
 * The harness itself is `e2e/clerk/harness.ts`, shared with the demo recording (#145).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

import { clerkHarnessConfig } from "./e2e/clerk/harness";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  clerkHarnessConfig({
    testDir: path.join(HERE, "e2e/clerk"),
    reportFolder: "playwright-report-clerk",
    timeout: 90_000,
  }),
);
