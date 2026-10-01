/**
 * Sign-up shown, not stubbed (spec #143 story 5): "Who are you?" on /sign-up, the role card,
 * "Continue as <role>", then Clerk's real prebuilt sign-up form with the run's fresh
 * `+clerk_test` address and the test verification code 424242 (no email is sent). The address
 * comes from `runIdentity().signUpEmails`, so the global teardown deletes the account.
 */
import { expect, type Page } from "@playwright/test";

import { runIdentity, type SignUpRole } from "../clerk/env";
import { HOME_HEADING } from "../clerk/helpers";
import { hold } from "./fixtures";

/** Clerk's fixed verification code for `+clerk_test` addresses on a development instance. */
export const CLERK_TEST_CODE = "424242";

const ROLE_CARD: Record<SignUpRole, RegExp> = { founder: /I’m a founder/, builder: /I’m a builder/ };

export async function signUpThroughForm(page: Page, role: SignUpRole): Promise<void> {
  const email = runIdentity().signUpEmails[role];
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { level: 1, name: "Who are you?" })).toBeVisible();
  await page.getByRole("button", { name: ROLE_CARD[role] }).click();
  await hold(page, 800);
  await page.getByRole("button", { name: `Continue as ${role}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Create your ${role} account` })).toBeVisible();

  const form = page.getByRole("region", { name: "Create account" });
  await form.getByLabel(/email address/i).fill(email);
  // The instance may also ask for a password or a name; fill whatever the form shows.
  const password = form.getByLabel(/^password/i);
  if (await password.isVisible()) await password.fill(`Demo-${runIdentity().runId}-pass!`);
  for (const [label, value] of [
    [/first name/i, "Demo"],
    [/last name/i, role === "founder" ? "Founder" : "Builder"],
  ] as const) {
    const field = form.getByLabel(label);
    if (await field.isVisible()) await field.fill(value);
  }
  await hold(page, 800);
  await form.getByRole("button", { name: "Continue", exact: true }).click();

  // Email-code verification: Clerk focuses its one-time-code input on arrival.
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  await expect(code).toBeVisible();
  await code.click();
  await page.keyboard.type(CLERK_TEST_CODE, { delay: 80 });

  // Clerk lands on /choose-role, which saves the role picked in step 1 and goes to the role's home.
  await expect(page.getByRole("heading", { level: 1, name: HOME_HEADING[role] })).toBeVisible({ timeout: 45_000 });
}
