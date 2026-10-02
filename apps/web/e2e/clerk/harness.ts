/**
 * The Clerk harness as a config builder, shared by `playwright.clerk.config.ts` (the Clerk specs)
 * and `playwright.demo.config.ts` (the demo recording, #145). Servers: the engine on the compose
 * `db` with LLM_PROVIDER=null, a per-run Svix test secret and ADMIN_EMAILS set to the run's admin
 * address, and a production build with the real VITE_CLERK_PUBLISHABLE_KEY from the repo-root
 * .env served by vite preview. Ports, output dir and build dir come from `env.ts` and differ per
 * suite, so no suite ever reuses another's servers.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { devices, type PlaywrightTestConfig } from "@playwright/test";

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
} from "./env";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export type HarnessOptions = {
  /** Absolute path of the suite's specs. */
  testDir: string;
  /** The HTML report folder, relative to the config file. */
  reportFolder: string;
  timeout: number;
  /** Merged over the chromium project's Desktop Chrome defaults (viewport 1440×900). */
  projectUse?: NonNullable<PlaywrightTestConfig["use"]>;
  /** Merged over the engine server's environment (default LLM_PROVIDER=null). */
  engineEnv?: Record<string, string>;
  /** Merged over the web build's environment. */
  webEnv?: Record<string, string>;
};

export function clerkHarnessConfig(options: HarnessOptions): PlaywrightTestConfig {
  const identity = runIdentity();
  const env = rootEnv();
  return {
    testDir: options.testDir,
    outputDir: OUTPUT_DIR,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    globalSetup: path.join(HERE, "global-setup.ts"),
    globalTeardown: path.join(HERE, "global-teardown.ts"),
    reporter: [["list"], ["html", { open: "never", outputFolder: options.reportFolder }]],
    timeout: options.timeout,
    expect: { timeout: 20_000 },
    use: {
      baseURL: WEB_URL,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
    },
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...options.projectUse },
      },
    ],
    webServer: [
      {
        // The reset removes the rows earlier runs' +clerk_test users left in the compose db before
        // the engine projects the store (#76), so every run starts from seed-only atoms.
        command: `uv run python scripts/e2e_reset.py && uv run python -m uvicorn app.main:app --port ${ENGINE_PORT}`,
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
          // Passed through so the engine never depends on finding the repo-root .env (CI has none;
          // without the JWKS URL every gated route answers 401, #77).
          ...(env.CLERK_JWKS_URL ? { CLERK_JWKS_URL: env.CLERK_JWKS_URL } : {}),
          ...(env.CLERK_SECRET_KEY ? { CLERK_SECRET_KEY: env.CLERK_SECRET_KEY } : {}),
          ...options.engineEnv,
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
          ...options.webEnv,
        },
      },
    ],
  };
}
