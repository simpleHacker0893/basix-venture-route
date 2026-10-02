/**
 * Deletes the run's three Clerk users (by stored id, then by email as a fallback) and any user a
 * demo signed up through the real form with the run's sign-up addresses (#146).
 */
import { existsSync, readFileSync } from "node:fs";

import { deleteUser, findUserIds } from "./clerkBackend";
import { clerkKeys, ROLES, runIdentity, SIGN_UP_ROLES, STATE_FILE, type SuiteState } from "./env";

export default async function globalTeardown(): Promise<void> {
  const { secretKey } = clerkKeys();
  const { emails, signUpEmails } = runIdentity();
  const ids = new Set<string>();
  if (existsSync(STATE_FILE)) {
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<SuiteState>;
    for (const role of ROLES) {
      const id = state.users?.[role]?.id;
      if (id) ids.add(id);
    }
  }
  for (const role of ROLES) {
    for (const id of await findUserIds(secretKey, emails[role])) ids.add(id);
  }
  for (const role of SIGN_UP_ROLES) {
    for (const id of await findUserIds(secretKey, signUpEmails[role])) ids.add(id);
  }
  for (const id of ids) await deleteUser(secretKey, id);
  console.log(`[clerk e2e] deleted ${ids.size} test user(s)`);
}
