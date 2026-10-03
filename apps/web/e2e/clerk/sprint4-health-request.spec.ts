/**
 * Sprint 004 acceptance Must 1 in the browser with the Health brief (#82): the founder routes the
 * Health pilot and publishes it as a request; the builder, whose `python` credential the admin
 * confirmed (`python` is one of the brief's three required skills), opens the board, sees
 * "Eligible · Python" on that request and places a bid. The verdict is the engine's (MeTTa over
 * projected facts); the spec reads only what the screens report.
 *
 * Self-contained: the first test enters the builder's profile and python credential through the
 * API with the builder's own session and confirms them as the admin.
 */
import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { readState } from "./env";
import { engineGet, expectRoleClaim, publishedRequests, publishedRequestTitle, signInAs, signOut } from "./helpers";

// Named to sort after marketplace.spec.ts and requests.spec.ts: those assume a founder with no briefs
// and an unconfirmed builder, so this spec (which adds both) must run last.
test.describe.configure({ mode: "serial" });

const SCENARIO = "Health pilot";
const runId = () => readState().runId;

let requestTitle = "";

async function engineJson(page: Page, method: "PUT" | "POST", path: string, token: string, body: unknown): Promise<APIResponse> {
  const { engineUrl } = readState();
  return page.request.fetch(`${engineUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: body,
  });
}

test("admin confirms the builder's account and python credential", async ({ page }) => {
  await signInAs(page, "builder");
  const builderToken = await expectRoleClaim(page, "/api/me/credentials");
  const profile = await engineJson(page, "PUT", "/api/me/profile", builderToken, {
    displayName: `E2E Builder ${runId()}`,
    headline: "Python builder",
    cohortId: null,
    location: "Nairobi",
    hourlyRate: 15,
    modes: { remote: true, hybrid: true, onSite: false },
    selfDescribedSkills: ["python"],
    phone: null,
    linkedin: null,
    sharing: { email: true, phone: false, linkedin: false },
    availability: [{ start: "2026-09-22", end: "2026-10-20" }],
  });
  expect(profile.status()).toBe(200);
  const credential = await engineJson(page, "POST", "/api/me/credentials", builderToken, {
    title: `Python services ${runId()} (health)`,
    issuer: "MeTTa OmniUniversity",
    skillId: "python",
  });
  expect(credential.status()).toBe(201);
  const credentialId = ((await credential.json()) as { id: string }).id;
  const me = (await (await engineGet(page, "/api/me/profile", builderToken)).json()) as { builderId: string };

  await signOut(page);
  await signInAs(page, "admin");
  const adminToken = await expectRoleClaim(page, "/api/admin/pending");
  const pending = (await (await engineGet(page, "/api/admin/pending", adminToken)).json()) as {
    accounts: { id: string; builderId: string | null }[];
  };
  // The account may already be confirmed by an earlier spec in the same run.
  const mine = pending.accounts.find((row) => row.builderId === me.builderId);
  if (mine) {
    expect((await engineJson(page, "POST", `/api/admin/confirm/account/${mine.id}`, adminToken, {})).status()).toBe(200);
  }
  expect((await engineJson(page, "POST", `/api/admin/confirm/credential/${credentialId}`, adminToken, {})).status()).toBe(200);
});

test("founder routes the Health pilot and publishes it as a request", async ({ page }) => {
  await signInAs(page, "founder");
  await expectRoleClaim(page, "/api/me/dashboard");
  // Inlined routeScenario with a longer wait: by this point the run has confirmed several builders,
  // so the engine's MeTTa route takes longer than the shared helper's 20 s.
  await page.goto("/route");
  await page.getByRole("button", { name: `Load scenario: ${SCENARIO}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
  await page.getByRole("button", { name: "Find my route" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Publish as request" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  const healthRow = publishedRequests(page).filter({ hasText: "Health pilot" }).first();
  await expect(healthRow).toContainText("Open");
  requestTitle = await publishedRequestTitle(healthRow);
  expect(requestTitle).toContain("Health pilot");
});

test("builder sees Eligible · Python on the Health request and bids", async ({ page }) => {
  await signInAs(page, "builder");
  await expectRoleClaim(page, "/api/me/bids");
  await page.goto("/requests");
  await expect(page.getByRole("heading", { level: 1, name: "Open requests" })).toBeVisible();

  const card = page.getByRole("article", { name: requestTitle }).first();
  await expect(card.getByTestId("verdict")).toHaveText("Eligible · Python");
  await expect(card.getByRole("button", { name: "Bid" })).toBeEnabled();
  await card.getByRole("button", { name: "Bid" }).click();

  const dialog = page.getByRole("dialog", { name: `Bid on ${requestTitle}` });
  await dialog.getByRole("textbox", { name: "Message to founder (optional)" }).fill("Health request bid");
  await dialog.getByRole("button", { name: "Submit bid" }).click();

  await expect(dialog).toBeHidden();
  await expect(card.getByText("Bid placed · USD 15 an hour")).toBeVisible();
});
