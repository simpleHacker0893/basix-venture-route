/**
 * Sprint 005a acceptance §Part A Must 8: a builder adds a project and puts it on the Showcase, a
 * BASIX admin confirms the project and then the Showcase entry in the `/admin` Showcase tab, and
 * a signed-out visitor sees it on the public `/showcase` gallery and its detail page. Visibility
 * is the engine's one SQL predicate (showcased ∧ showcase confirmed ∧ project confirmed ∧ account
 * confirmed, D-52) — this spec only drives the screens and reads what they show.
 *
 * Self-contained: the builder's own profile and project go through the API/UI exactly like
 * marketplace.spec.ts, so this file passes on its own or alongside the other Clerk specs.
 */
import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { readState } from "./env";
import { expectRoleClaim, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const runId = () => readState().runId;
const displayName = () => `E2E Showcase Builder ${runId()}`;
const projectTitle = () => `Showcase round trip ${runId()}`;
const description = () => `A showcase entry created end-to-end by run ${runId()}.`;

async function engineJson(page: Page, method: "PUT" | "POST", path: string, token: string, body: unknown): Promise<APIResponse> {
  const { engineUrl } = readState();
  return page.request.fetch(`${engineUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: body,
  });
}

async function lastDecisionText(page: Page): Promise<string> {
  const status = page.getByRole("status", { name: "Last decision" });
  await expect(status).toContainText("projected_rows:");
  return (await status.textContent()) ?? "";
}

test("builder creates a profile and a project, then puts it on the Showcase (Pending review)", async ({ page }) => {
  await signInAs(page, "builder");
  const builderToken = await expectRoleClaim(page, "/api/me/projects");
  const profile = await engineJson(page, "PUT", "/api/me/profile", builderToken, {
    displayName: displayName(),
    headline: "Showcase e2e builder",
    cohortId: null,
    location: "Nairobi",
    dayRate: 150,
    modes: { remote: true, hybrid: false, onSite: false },
    selfDescribedSkills: ["frontend"],
    phone: null,
    linkedin: null,
    sharing: { email: true, phone: false, linkedin: false },
    availability: [{ start: "2026-09-22", end: "2026-10-20" }],
  });
  expect(profile.status()).toBe(200);

  await page.goto("/profile/projects/new");
  const project = page.getByRole("form", { name: "Add a showcase project" });
  await project.getByLabel("Project title").fill(projectTitle());
  await project.getByRole("radio", { name: "Education" }).check({ force: true });
  await project.getByRole("checkbox", { name: "Frontend" }).check({ force: true });
  await project.getByLabel("Completion date").fill("2026-09-01");
  await project.getByRole("button", { name: "Submit for confirmation" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();

  const row = page.getByRole("list", { name: "Projects" }).getByRole("listitem", { name: projectTitle() });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit showcase" }).click();

  const editor = page.getByRole("form", { name: `Showcase details for ${projectTitle()}` });
  await editor.getByLabel("Description").fill(description());
  await editor.getByLabel("Live URL").fill("https://example.com/showcase-round-trip/live");
  await editor.getByLabel("Demo URL").fill("https://example.com/showcase-round-trip/demo");
  await editor.getByLabel("YouTube pitch link").fill("https://youtu.be/dQw4w9WgXcQ");
  await editor.getByLabel("Pitch deck URL").fill("https://example.com/showcase-round-trip/deck");
  await editor.getByLabel("Show on Showcase").check();
  await editor.getByRole("button", { name: "Save showcase details" }).click();

  await expect(editor.getByText("Showcase details saved.")).toBeVisible();
  await expect(row).toContainText("Pending review");
});

test("admin confirms the builder's account and project", async ({ page }) => {
  await signInAs(page, "admin");
  await expectRoleClaim(page, "/api/admin/pending");

  const accounts = page.getByRole("row", { name: displayName() });
  if (await accounts.count()) {
    await accounts.getByRole("button", { name: "Confirm" }).click();
    await expect(accounts).toHaveCount(0);
  }

  await page.getByRole("tab", { name: /Projects/ }).click();
  const project = page.getByRole("row", { name: projectTitle() });
  await project.getByRole("button", { name: "Confirm" }).click();
  await expect(project).toHaveCount(0);
});

test("admin confirms the Showcase entry in the Showcase tab; the entry leaves the pending queue", async ({ page }) => {
  await signInAs(page, "admin");

  await page.getByRole("tab", { name: /Showcase/ }).click();
  const entry = page.getByRole("article", { name: projectTitle() });
  await expect(entry).toBeVisible();
  await entry.getByRole("button", { name: "Confirm" }).click();

  await expect(entry).toHaveCount(0);
  await expect(await lastDecisionText(page)).toContain(`Confirmed showcase "${projectTitle()}"`);
});

test("a signed-out visitor sees the entry on /showcase and its detail page", async ({ page }) => {
  // A fresh browser context per test carries no Clerk session: this is the anonymous visitor.
  await page.goto("/showcase");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Sign in" })).toBeVisible();
  const card = page.getByRole("article", { name: projectTitle() });
  await expect(card).toBeVisible();
  // Every row carries demo_data=true (CHECK constraint, AGENTS.md rule 5), so the pill is never hidden.
  await expect(card.getByText("Demo data")).toBeVisible();

  await page.getByRole("link", { name: projectTitle() }).click();
  await expect(page.getByRole("heading", { level: 1, name: projectTitle() })).toBeVisible();
  await expect(page.getByText(description())).toBeVisible();

  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Play pitch" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");

  const builderPanel = page.getByRole("complementary", { name: "Builder" });
  await expect(builderPanel).toContainText(displayName());
});
