/**
 * The demo recording (#143, #145): drives the real app scene by scene on the Clerk harness
 * (`e2e/clerk/harness.ts`: its env, global setup and teardown, engine and preview servers and
 * the `+clerk_test` email-code sign-in) and records each scene at 1920×1080 with a moderate
 * slow-mo. One worker, no retries: a flaky take fails. Local only, never in CI (D-33).
 * Its own ports (engine 8002, preview 4176) keep it off the no-key and Clerk suites' servers.
 * Clips land in `demo-output/clips/<scene-id>.webm` (git-ignored). Run: `pnpm demo:record`.
 *
 * Two differences from the Clerk suite's servers: the build sets VITE_VOICE_PROVIDER=fake, so
 * founder scenes drive Chloe through the fake provider's window hook (D-51, as `e2e/chloe.spec.ts`
 * does), and the engine takes LLM_PROVIDER from the repo-root .env instead of null, so a spoken
 * brief is really extracted on camera. The engine reads that provider's key from the same .env.
 */
import "./e2e/demo/suite";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

import { rootEnv } from "./e2e/clerk/env";
import { clerkHarnessConfig } from "./e2e/clerk/harness";
import { VIDEO_SIZE } from "./e2e/demo/clips";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  clerkHarnessConfig({
    testDir: path.join(HERE, "e2e/demo"),
    reportFolder: "playwright-report-demo",
    timeout: 180_000,
    projectUse: {
      viewport: VIDEO_SIZE,
      video: { mode: "on", size: VIDEO_SIZE },
      launchOptions: { slowMo: 250 },
    },
    engineEnv: { LLM_PROVIDER: rootEnv().LLM_PROVIDER || "null" },
    webEnv: { VITE_VOICE_PROVIDER: "fake" },
  }),
);
