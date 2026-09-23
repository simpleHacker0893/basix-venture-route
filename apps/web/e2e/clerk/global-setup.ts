/**
 * Global setup for the Clerk suite: the Clerk testing token (bot-protection bypass), then three
 * fresh `+clerk_test` users per run. The admin's role never comes from the payload: the engine's
 * webhook bootstrap (ADMIN_EMAILS, D-03) runs for real through a self-signed Svix event and
 * writes `publicMetadata.role = admin` back to Clerk. Ids and emails go to the output dir for
 * the specs; the teardown deletes the users.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { clerkSetup } from "@clerk/testing/playwright";

import { createTestUser, postUserCreated } from "./clerkBackend";
import { clerkKeys, ENGINE_URL, OUTPUT_DIR, ROLES, runIdentity, STATE_FILE, type SuiteState } from "./env";

export default async function globalSetup(): Promise<void> {
  const { publishableKey, secretKey } = clerkKeys();
  await clerkSetup({ publishableKey, secretKey, dotenv: false });
  const identity = runIdentity();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const state: SuiteState = { runId: identity.runId, engineUrl: ENGINE_URL, users: {} as SuiteState["users"] };
  for (const role of ROLES) {
    state.users[role] = await createTestUser(secretKey, identity.emails[role], `${role[0]?.toUpperCase()}${role.slice(1)}`);
    // Persist after every user so the teardown can delete them even if a later step throws.
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  const answer = await postUserCreated(ENGINE_URL, identity.webhookSecret, state.users.admin);
  if (answer.role !== "admin" || answer.confirmed !== true) {
    throw new Error(`ADMIN_EMAILS bootstrap did not yield a confirmed admin: ${JSON.stringify(answer)}`);
  }
  console.log(
    `[clerk e2e] run ${identity.runId}: users ${ROLES.map((role) => `${role}=${state.users[role].id}`).join(" ")}; ` +
      `admin webhook → ${JSON.stringify(answer)}`,
  );
}
