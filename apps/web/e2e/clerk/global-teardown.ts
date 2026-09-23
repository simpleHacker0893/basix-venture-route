/** Deletes the run's three Clerk users (by stored id, then by email as a fallback). */
import { existsSync, readFileSync } from "node:fs";

import { deleteUser, findUserIds } from "./clerkBackend";
import { clerkKeys, ROLES, runIdentity, STATE_FILE, type SuiteState } from "./env";

export default async function globalTeardown(): Promise<void> {
  const { secretKey } = clerkKeys();
  const { emails } = runIdentity();
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
  for (const id of ids) await deleteUser(secretKey, id);
  console.log(`[clerk e2e] deleted ${ids.size} test user(s)`);
}
