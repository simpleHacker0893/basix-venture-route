/**
 * Sprint 004 acceptance, Must lines 1–3 in the browser (#76): the founder routes the Constrained
 * brief and publishes it as a request; the builder (confirmed for `mobile` by the admin) opens
 * the board, sees "Eligible · Mobile" and bids; the founder sees the bid on the dashboard and
 * proposes an interview; the builder counters; the founder accepts; the booking screen shows
 * Confirmed with three history entries. Every verdict is the engine's (MeTTa over projected
 * facts); the spec reads only what the screens report.
 *
 * Self-contained: the first test enters the builder's profile and mobile credential through
 * the API with the builder's own session and confirms them as the admin, so the file passes on
 * its own or after marketplace.spec.ts (a second credential is harmless).
 */
import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { routeScenario } from "../helpers";
import { readState } from "./env";
import { engineGet, expectRoleClaim, sessionToken, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const SCENARIO = "Constrained brief";
const runId = () => readState().runId;
const displayName = () => `E2E Builder ${runId()}`;

let builderId = "";
let requestTitle = "";
let bookingUrl = "";

async function engineJson(page: Page, method: "PUT" | "POST", path: string, token: string, body: unknown): Promise<APIResponse> {
  const { engineUrl } = readState();
  return page.request.fetch(`${engineUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: body,
  });
}

test("admin confirms the builder's account and mobile credential", async ({ page }) => {
  await signInAs(page, "builder");
  const builderToken = await expectRoleClaim(page, "/api/me/credentials");
  const profile = await engineJson(page, "PUT", "/api/me/profile", builderToken, {
    displayName: displayName(),
    headline: "Mobile builder",
    cohortId: null,
    location: "Nairobi",
    dayRate: 120,
    modes: { remote: true, hybrid: false, onSite: false },
    selfDescribedSkills: ["mobile"],
    phone: null,
    linkedin: null,
    sharing: { email: true, phone: false, linkedin: false },
    availability: [{ start: "2026-09-22", end: "2026-10-20" }],
  });
  expect(profile.status()).toBe(200);
  builderId = ((await profile.json()) as { builderId: string }).builderId;
  const credential = await engineJson(page, "POST", "/api/me/credentials", builderToken, {
    title: `Mobile field apps ${runId()} (round-trip)`,
    issuer: "MeTTa OmniUniversity",
    skillId: "mobile",
  });
  expect(credential.status()).toBe(201);
  const credentialId = ((await credential.json()) as { id: string }).id;
  const me = (await (await engineGet(page, "/api/me/profile", builderToken)).json()) as { builderId: string };
  const account = (await (await engineGet(page, "/api/admin/pending", builderToken)).json()) as unknown;
  expect(account).toMatchObject({ detail: "role admin required" });

  await signInAs(page, "admin");
  const adminToken = await expectRoleClaim(page, "/api/admin/pending");
  const pending = (await (await engineGet(page, "/api/admin/pending", adminToken)).json()) as {
    accounts: { id: string; builderId: string | null }[];
  };
  const mine = pending.accounts.find((row) => row.builderId === me.builderId);
  // The account may already be confirmed by marketplace.spec.ts in the same run.
  if (mine) {
    expect((await engineJson(page, "POST", `/api/admin/confirm/account/${mine.id}`, adminToken, {})).status()).toBe(200);
  }
  expect((await engineJson(page, "POST", `/api/admin/confirm/credential/${credentialId}`, adminToken, {})).status()).toBe(200);
});

test("founder routes the Constrained brief and publishes it as a request", async ({ page }) => {
  await signInAs(page, "founder");
  await expectRoleClaim(page, "/api/me/dashboard");
  await routeScenario(page, SCENARIO);

  await page.getByRole("button", { name: "Publish as request" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your ventures" })).toBeVisible();
  const table = page.getByRole("table", { name: "Briefs and routes" });
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(2);
  const firstRow = rows.nth(1);
  await expect(firstRow).toContainText("Open");
  requestTitle = (await firstRow.getByRole("cell").first().locator("span").first().textContent()) ?? "";
  expect(requestTitle.length).toBeGreaterThan(0);
  await expect(page.locator('[data-tile="briefs"]')).toContainText("1");
});

test("builder sees Eligible · Mobile on the board and bids", async ({ page }) => {
  await signInAs(page, "builder");
  await expectRoleClaim(page, "/api/me/bids");
  await page.goto("/requests");
  await expect(page.getByRole("heading", { level: 1, name: "Open requests" })).toBeVisible();

  const card = page.getByRole("article", { name: requestTitle }).first();
  await expect(card.getByTestId("verdict")).toHaveText("Eligible · Mobile");
  await expect(card.getByRole("button", { name: "Bid" })).toBeEnabled();
  await card.getByRole("button", { name: "Bid" }).click();

  const dialog = page.getByRole("dialog", { name: `Bid on ${requestTitle}` });
  await expect(dialog.getByRole("spinbutton", { name: "Your day rate (USD)" })).toHaveValue("120");
  await dialog.getByRole("textbox", { name: "Message to founder (optional)" }).fill("Round-trip bid");
  await dialog.getByRole("button", { name: "Submit bid" }).click();

  await expect(dialog).toBeHidden();
  await expect(card.getByText("Bid placed · USD 120 / day")).toBeVisible();
});

test("founder sees the bid on the dashboard and proposes an interview", async ({ page }) => {
  await signInAs(page, "founder");
  await page.goto("/dashboard");
  const bids = page.getByRole("region", { name: "Bids received" });
  await expect(bids).toContainText(displayName());
  await expect(bids).toContainText("USD 120 / day");

  await bids.getByRole("link", { name: "Book interview" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: `Book an interview with ${displayName()}` })).toBeVisible();
  await page.getByRole("button", { name: /September 24th, 2026/ }).click();
  await page.getByRole("radio", { name: "10:30 EAT" }).click();
  await page.getByRole("radio", { name: "30 min" }).click();
  await page.getByRole("textbox", { name: "Notes to builder (optional)" }).fill("Intro call");
  await expect(page.getByTestId("summary")).toContainText("Thu 24 Sep 2026 · 10:30 – 11:00 EAT");
  await page.getByRole("button", { name: "Send proposal" }).click();

  await expect(page.getByRole("heading", { level: 1, name: `Interview with ${displayName()}` })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Proposed");
  bookingUrl = new URL(page.url()).pathname;
  expect(bookingUrl).toMatch(/^\/bookings\/[0-9a-f-]{36}$/);
});

test("builder counters with another time", async ({ page }) => {
  await signInAs(page, "builder");
  await page.goto(bookingUrl);
  await expect(page.getByRole("heading", { level: 1, name: `Interview with ${displayName()}` })).toBeVisible();

  await page.getByRole("group", { name: "Actions" }).getByRole("button", { name: "Counter" }).click();
  await page.getByRole("button", { name: /September 25th, 2026/ }).click();
  await page.getByRole("radio", { name: "09:00 EAT" }).click();
  await page.getByRole("radio", { name: "45 min" }).click();
  await page.getByRole("textbox", { name: "Notes to builder (optional)" }).fill("Morning suits me");
  await page.getByRole("button", { name: "Send counter" }).click();

  await expect(page.getByText("Countered · awaiting the founder")).toBeVisible();
  await expect(page.getByRole("list", { name: "History" }).getByRole("listitem")).toHaveCount(2);
});

test("founder accepts the counter: state confirmed, three history entries", async ({ page }) => {
  await signInAs(page, "founder");
  await page.goto(bookingUrl);
  await expect(page.getByRole("heading", { level: 1, name: `Interview with ${displayName()}` })).toBeVisible();

  await page.getByRole("group", { name: "Actions" }).getByRole("button", { name: "Accept" }).click();

  await expect(page.locator('[aria-current="step"]')).toContainText("Confirmed");
  const history = page.getByRole("list", { name: "History" }).getByRole("listitem");
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText("Founder proposed");
  await expect(history.nth(1)).toContainText("Builder countered");
  await expect(history.nth(2)).toContainText("Founder confirmed");
  await expect(page.getByText("The interview is confirmed.")).toBeVisible();

  const token = await sessionToken(page);
  const bookings = (await (await engineGet(page, "/api/me/bookings", token)).json()) as { state: string; history: unknown[]; builderId: string }[];
  const mine = bookings.find((row) => row.builderId === builderId);
  expect(mine?.state).toBe("confirmed");
  expect(mine?.history).toHaveLength(3);
});
