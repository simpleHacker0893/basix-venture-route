/**
 * Shared facts for the Clerk three-role suite (Sprint 003 #47).
 *
 * Keys come only from the repo-root `.env` (D-26) through Vite's `loadEnv`, so nothing here is
 * ever written into a tracked file. The suite owns its own ports (engine 8001, preview 4175) so
 * it never collides with the no-key `playwright.config.ts` suite on 8000/4173, which reuses any
 * server it finds. Per-run identity (run id, Svix test secret, the three `+clerk_test` emails)
 * is minted once in the runner process and inherited by the workers through `process.env`.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(HERE, "../..");
export const REPO_ROOT = path.resolve(WEB_DIR, "../..");
export const ENGINE_DIR = path.resolve(REPO_ROOT, "services/engine");

export const ENGINE_PORT = 8001;
export const WEB_PORT = 4175;
export const ENGINE_URL = `http://localhost:${ENGINE_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
/** The compose `db` (postgres:18, D-37); never Neon for this suite. */
export const COMPOSE_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/venture_route";
export const OUTPUT_DIR = path.resolve(WEB_DIR, "test-results-clerk");
export const STATE_FILE = path.join(OUTPUT_DIR, "clerk-users.json");
export const BUILD_DIR = "dist-clerk";

export type Role = "founder" | "builder" | "admin";
export const ROLES: readonly Role[] = ["founder", "builder", "admin"];

export type TestUser = { id: string; email: string; emailAddressId: string };
export type SuiteState = { runId: string; engineUrl: string; users: Record<Role, TestUser> };

/** Every variable in the root .env; only VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are read. */
export function rootEnv(): Record<string, string> {
  return loadEnv("production", REPO_ROOT, "");
}

export function clerkKeys(): { publishableKey: string; secretKey: string } {
  const env = rootEnv();
  const publishableKey = env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = env.CLERK_SECRET_KEY ?? "";
  if (!publishableKey.startsWith("pk_test_") || !secretKey.startsWith("sk_test_")) {
    throw new Error(
      "The Clerk suite needs a development-instance VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in the repo-root .env (D-26).",
    );
  }
  return { publishableKey, secretKey };
}

export type RunIdentity = { runId: string; webhookSecret: string; emails: Record<Role, string> };

/** Minted once per run; workers inherit the values from the runner's environment. */
export function runIdentity(): RunIdentity {
  if (!process.env.E2E_CLERK_RUN_ID) {
    process.env.E2E_CLERK_RUN_ID = randomBytes(4).toString("hex");
  }
  if (!process.env.E2E_CLERK_WEBHOOK_SECRET) {
    process.env.E2E_CLERK_WEBHOOK_SECRET = `whsec_${randomBytes(24).toString("base64")}`;
  }
  const runId = process.env.E2E_CLERK_RUN_ID;
  const emails = Object.fromEntries(
    ROLES.map((role) => [role, `vr-e2e-${runId}-${role}+clerk_test@example.com`]),
  ) as Record<Role, string>;
  return { runId, webhookSecret: process.env.E2E_CLERK_WEBHOOK_SECRET, emails };
}

export function readState(): SuiteState {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`${STATE_FILE} is missing: the global setup did not create the test users.`);
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as SuiteState;
}
