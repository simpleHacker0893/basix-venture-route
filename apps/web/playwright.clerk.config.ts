/**
 * Playwright with Clerk test users (Sprint 003 #47): the three-role smoke and the
 * confirm-then-route flow. Runs locally only; CI keeps the no-key `playwright.config.ts` suite
 * (D-33). Servers: the engine on the compose `db` with LLM_PROVIDER=null, a per-run Svix test
 * secret and ADMIN_EMAILS set to the run's admin address (port 8001), and a production build
 * with the real VITE_CLERK_PUBLISHABLE_KEY from the repo-root .env served by vite preview on
 * 4175. Both ports differ from the no-key suite's so the two never reuse each other's servers.
 */
import { defineConfig, devices } from "@playwright/test";

import {
  BUILD_DIR,
  COMPOSE_DATABASE_URL,
  ENGINE_DIR,
  ENGINE_PORT,
  ENGINE_URL,
  OUTPUT_DIR,
  rootEnv,
  runIdentity,
  WEB_PORT,
  WEB_URL,
} from "./e2e/clerk/env";

const identity = runIdentity();
const env = rootEnv();

export default defineConfig({
  testDir: "./e2e/clerk",
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: "./e2e/clerk/global-setup.ts",
  globalTeardown: "./e2e/clerk/global-teardown.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-clerk" }]],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: `uv run python -m uvicorn app.main:app --port ${ENGINE_PORT}`,
      cwd: ENGINE_DIR,
      url: `${ENGINE_URL}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: COMPOSE_DATABASE_URL,
        LLM_PROVIDER: "null",
        CORS_ORIGINS: WEB_URL,
        ENGINE_DEV_QUERY: "0",
        CLERK_WEBHOOK_SIGNING_SECRET: identity.webhookSecret,
        ADMIN_EMAILS: identity.emails.admin,
      },
    },
    {
      command: `pnpm exec vite build --outDir ${BUILD_DIR} && pnpm exec vite preview --outDir ${BUILD_DIR} --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        VITE_API_URL: ENGINE_URL,
        VITE_OFFLINE_DEMO: "0",
        VITE_CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
      },
    },
  ],
});
