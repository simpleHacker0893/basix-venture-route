/**
 * Sprint 003 acceptance, Must line 1: founder, builder and admin sign in with Clerk test users
 * and land on their home screens; a builder gets 403 on /api/admin/pending and is sent away
 * from /admin. The engine reads the role from the session token's `metadata` claim (D-03): a
 * 403 on the builder's own /api/me routes means that claim is missing from the Clerk session
 * token template, which is an Operator Dashboard step, not something this suite works around.
 */
import { expect, test } from "@playwright/test";

import { engineGet, expectRoleClaim, HOME_HEADING, signInAs } from "./helpers";

test.describe("three-role smoke", () => {
  test("founder signs in, chooses founder on /choose-role and lands on the intake", async ({ page }) => {
    await signInAs(page, "founder");

    await expect(page).toHaveURL(/\/route$/);
    await expect(page.getByRole("heading", { level: 1, name: HOME_HEADING.founder })).toBeVisible();
  });

  test("builder signs in, lands on Your profile, is refused on /api/admin/pending and sent away from /admin", async ({ page }) => {
    await signInAs(page, "builder");

    await expect(page).toHaveURL(/\/profile$/);
    const token = await expectRoleClaim(page, "/api/me/credentials");
    const pending = await engineGet(page, "/api/admin/pending", token);
    expect(pending.status()).toBe(403);
    expect(await pending.json()).toEqual({ detail: "role admin required" });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: HOME_HEADING.builder })).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("admin (bootstrapped by the ADMIN_EMAILS webhook) signs in and lands on the confirmation queue", async ({ page }) => {
    await signInAs(page, "admin");

    await expect(page).toHaveURL(/\/admin$/);
    const token = await expectRoleClaim(page, "/api/admin/pending");
    const pending = await engineGet(page, "/api/admin/pending", token);
    expect(pending.status()).toBe(200);
  });
});
