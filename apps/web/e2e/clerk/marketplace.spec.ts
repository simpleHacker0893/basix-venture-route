/**
 * Sprint 003 acceptance, Must lines 2–4: the builder submits a profile, a credential and a
 * licensable project; the founder's Constrained brief (mobile + rust) excludes the pending
 * builder and shows the mobile skill gap; the admin confirms all three, projected_rows rises,
 * the route includes the builder with evidence Both; the admin rejects the project and the
 * evidence drops to Credential. Every decision is the engine's (MeTTa rules over projected facts);
 * the specs only read what the screens and /health report.
 */
import { expect, test, type Page } from "@playwright/test";

import { builderIds, routeScenario } from "../helpers";
import { readState } from "./env";
import { engineGet, enginePost, expectRoleClaim, sessionToken, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const SCENARIO = "Constrained brief";
const runId = () => readState().runId;
const displayName = () => `E2E Builder ${runId()}`;
const credentialTitle = () => `Mobile field apps ${runId()}`;
const projectTitle = () => `Agri scouting app ${runId()}`;

let builderId = "";
let projectId = "";

function builderCard(page: Page) {
  return page.getByTestId("builder-card").filter({ has: page.getByTestId("builder-id").filter({ hasText: builderId }) });
}

async function lastDecisionRows(page: Page): Promise<number> {
  const status = page.getByRole("status", { name: "Last decision" });
  await expect(status).toContainText("projected_rows:");
  const match = /projected_rows:\s*(\d+)/.exec((await status.textContent()) ?? "");
  return Number(match?.[1] ?? Number.NaN);
}

test("builder creates a profile with availability, a mobile credential and a licensable agri project", async ({ page }) => {
  await signInAs(page, "builder");
  await expectRoleClaim(page, "/api/me/credentials");

  const form = page.getByRole("form", { name: "Builder profile" });
  await form.getByLabel("Display name").fill(displayName());
  await form.getByLabel("Primary location / base").fill("Nairobi");
  await form.getByLabel("Day rate").fill("120");
  await form.getByRole("checkbox", { name: "Remote" }).check({ force: true });
  await form.getByRole("checkbox", { name: "Mobile" }).check({ force: true });
  await page.getByRole("button", { name: /September 22nd, 2026/ }).first().click();
  await page.getByRole("button", { name: /October 20th, 2026/ }).first().click();
  await expect(form.getByText("Selected window:")).toContainText("2026-09-22");
  await form.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByText("Pending BASIX confirmation")).toBeVisible();

  const credential = page.getByRole("form", { name: "Add credential" });
  await credential.getByLabel("Credential title").fill(credentialTitle());
  await credential.getByLabel("Issuer").fill("MeTTa OmniUniversity");
  await credential.getByLabel("Skill").selectOption("mobile");
  await credential.getByRole("button", { name: "Add credential" }).click();
  const credentialRow = page.getByRole("list", { name: "Credentials" }).getByRole("listitem", { name: credentialTitle() });
  await expect(credentialRow).toContainText("Pending");

  await page.goto("/profile/projects/new");
  const project = page.getByRole("form", { name: "Add a showcase project" });
  await project.getByLabel("Project title").fill(projectTitle());
  await project.getByRole("radio", { name: "Agri" }).check({ force: true });
  await project.getByRole("checkbox", { name: "Mobile" }).check({ force: true });
  await project.getByLabel("Completion date").fill("2026-08-31");
  await project.getByRole("checkbox", { name: "Licensable as reusable IP" }).check({ force: true });
  await project.getByRole("button", { name: "Submit for confirmation" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();

  const token = await sessionToken(page);
  const profile = await engineGet(page, "/api/me/profile", token);
  expect(profile.status()).toBe(200);
  builderId = ((await profile.json()) as { builderId: string }).builderId;
  expect(builderId).toMatch(/^e2e-builder-/);
  const projects = (await (await engineGet(page, "/api/me/projects", token)).json()) as { id: string; title: string; status: string }[];
  const mine = projects.find((row) => row.title === projectTitle());
  expect(mine?.status).toBe("pending");
  projectId = mine?.id ?? "";
});

test("founder: the Constrained brief routes without the pending builder and shows the mobile skill gap", async ({ page }) => {
  await signInAs(page, "founder");
  await routeScenario(page, SCENARIO);

  await expect(page.getByTestId("status-badge")).toHaveText("Partial");
  expect(await builderIds(page)).not.toContain(builderId);
  const gap = page.getByTestId("gap").filter({ hasText: "mobile" });
  await expect(gap).toHaveCount(1);
  await expect(gap).toContainText("skill");
});

test("admin confirms the account, credential and project; projected_rows rises on /health", async ({ page }) => {
  await signInAs(page, "admin");
  await expectRoleClaim(page, "/api/admin/pending");
  const before = ((await (await engineGet(page, "/health")).json()) as { projected_rows: number }).projected_rows;

  const accounts = page.getByRole("row", { name: displayName() });
  await accounts.getByRole("button", { name: "Confirm" }).click();
  await expect(accounts).toHaveCount(0);
  const afterAccount = await lastDecisionRows(page);
  expect(afterAccount).toBeGreaterThan(before);

  await page.getByRole("tab", { name: /Credentials/ }).click();
  const credential = page.getByRole("row", { name: credentialTitle() });
  await credential.getByRole("button", { name: "Confirm" }).click();
  await expect(credential).toHaveCount(0);
  const afterCredential = await lastDecisionRows(page);
  expect(afterCredential).toBeGreaterThan(afterAccount);

  await page.getByRole("tab", { name: /Projects/ }).click();
  const project = page.getByRole("row", { name: projectTitle() });
  await project.getByRole("button", { name: "Confirm" }).click();
  await expect(project).toHaveCount(0);
  const afterProject = await lastDecisionRows(page);
  expect(afterProject).toBeGreaterThan(afterCredential);

  const health = (await (await engineGet(page, "/health")).json()) as { projected_rows: number };
  expect(health.projected_rows).toBe(afterProject);
  expect(health.projected_rows).toBeGreaterThan(0);
});

test("founder: the rerun includes the confirmed builder with evidence Both", async ({ page }) => {
  await signInAs(page, "founder");
  await routeScenario(page, SCENARIO);

  expect(await builderIds(page)).toContain(builderId);
  await expect(builderCard(page).getByTestId("evidence-badge")).toHaveText("Both");
  await expect(page.getByTestId("gap").filter({ hasText: "mobile" })).toHaveCount(0);
});

test("admin rejects the project; the founder's rerun shows evidence Credential", async ({ page }) => {
  await signInAs(page, "admin");
  const adminToken = await sessionToken(page);
  // A confirmed row has left the pending queue, so the reversal goes through the same endpoint
  // the queue's Reject button posts to (repo.decide allows any transition and logs it).
  const rejected = await enginePost(page, `/api/admin/reject/project/${projectId}`, adminToken);
  expect(rejected.status()).toBe(200);
  expect(await rejected.json()).toMatchObject({ kind: "project", status: "rejected" });

  await signInAs(page, "founder");
  await routeScenario(page, SCENARIO);

  expect(await builderIds(page)).toContain(builderId);
  await expect(builderCard(page).getByTestId("evidence-badge")).toHaveText("Credential");
});
