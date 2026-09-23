/**
 * Playwright against `vite preview` (production build) with the engine on LLM_PROVIDER=null and
 * CORS_ORIGINS=http://localhost:4173 (PROMPTS.md §Sprint 002, D-32, D-33). A second preview on
 * 4174 serves the VITE_OFFLINE_DEMO=1 build for the offline lines.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(HERE, "../../services/engine");
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: "uv run python -m uvicorn app.main:app --port 8000",
      cwd: ENGINE_DIR,
      url: "http://localhost:8000/health",
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: { LLM_PROVIDER: "null", CORS_ORIGINS: "http://localhost:4173", ENGINE_DEV_QUERY: "0" },
    },
    {
      command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: !isCI,
      timeout: 180_000,
      // No-key run (D-33): the placeholder key keeps this suite deterministic on a machine
      // whose root .env holds a real Clerk key; the Clerk smoke has its own config.
      env: { VITE_API_URL: "http://localhost:8000", VITE_OFFLINE_DEMO: "0", VITE_CLERK_PUBLISHABLE_KEY: "pk_test_replace-me" },
    },
    {
      command:
        "pnpm exec vite build --outDir dist-offline && pnpm exec vite preview --outDir dist-offline --port 4174 --strictPort",
      url: "http://localhost:4174",
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: { VITE_API_URL: "http://localhost:8000", VITE_OFFLINE_DEMO: "1", VITE_CLERK_PUBLISHABLE_KEY: "pk_test_replace-me" },
    },
  ],
});
