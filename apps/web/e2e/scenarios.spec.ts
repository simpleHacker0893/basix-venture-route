/**
 * Sprint 002 acceptance, Playwright lines against vite preview + the engine on LLM_PROVIDER=null.
 * Expected values are the DOMAIN.md scenarios as the engine decides them.
 */
import { expect, test } from "@playwright/test";

import { builderIds, builderNames, routeScenario } from "./helpers";

test.describe("scenarios through the founder flow", () => {
  test("Health pilot: Feasible badge, three cards with evidence badges and Demo data pills, cost strip, context cards", async ({ page }) => {
    await routeScenario(page, "Health pilot");

    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
    const cards = page.getByTestId("builder-card");
    await expect(cards).toHaveCount(3);
    expect(await builderNames(page)).toEqual(["Amina Otieno", "Daniel Kiptoo", "Grace Wambui"]);
    await expect(cards.getByTestId("evidence-badge")).toHaveText(["Both", "Both", "Credential"]);
    for (let i = 0; i < 3; i += 1) await expect(cards.nth(i).getByText("Demo data")).toBeVisible();
    const strip = page.getByTestId("cost-strip");
    await expect(strip).toContainText("USD 370 / day");
    await expect(strip).toContainText("USD 400 / day");
    await expect(page.getByTestId("ip-card")).toContainText("asset-afya-triage");
    await expect(page.getByTestId("cohort-card")).toContainText("cohort-2026a");
    await expect(page.getByTestId("partner-card")).toContainText("amani-health");
  });

  test("Constrained brief: Partial, gaps panel precedes the team section, one route-gap with two D-29 actions, one card", async ({ page }) => {
    await routeScenario(page, "Constrained brief");

    await expect(page.getByTestId("status-badge")).toHaveText("Partial");
    const gapsBeforeTeam = await page.evaluate(() => {
      const gaps = document.querySelector('[data-testid="gaps-panel"]');
      const team = document.querySelector('[data-testid="team-section"]');
      return !!gaps && !!team && !!(gaps.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(gapsBeforeTeam).toBe(true);
    const gaps = page.getByTestId("gap");
    await expect(gaps).toHaveCount(1);
    await expect(gaps.first()).toContainText("route-gap");
    await expect(gaps.first()).toContainText("mobile");
    await expect(gaps.first().getByRole("button")).toHaveText([
      "Ask BASIX to confirm a credential or project for mobile.",
      "Remove mobile from the brief or replace it with a related skill.",
    ]);
    expect(await builderNames(page)).toEqual(["Zawadi Njoroge"]);
  });

  test("Delivery-mode challenge: Infeasible, three location gaps, empty team, no context cards", async ({ page }) => {
    await routeScenario(page, "Delivery-mode challenge");

    await expect(page.getByTestId("status-badge")).toHaveText("Infeasible");
    const gaps = page.getByTestId("gap");
    await expect(gaps).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) await expect(gaps.nth(i)).toContainText("location");
    await expect(page.getByText("No verified builder fits this brief yet")).toBeVisible();
    await expect(page.getByTestId("builder-card")).toHaveCount(0);
    await expect(page.getByTestId("ip-card")).toHaveCount(0);
    await expect(page.getByTestId("cohort-card")).toHaveCount(0);
    await expect(page.getByTestId("partner-card")).toHaveCount(0);
  });

  test("Why this route? on the Health pilot: partner path with four facts in order, Technical view in monospace", async ({ page }) => {
    await routeScenario(page, "Health pilot");

    await page.getByRole("button", { name: "Why this route?" }).click();
    const drawer = page.getByRole("dialog", { name: "Why this route?" });
    await expect(drawer).toBeVisible();
    const partner = drawer.getByTestId("path-partner");
    await expect(partner).toContainText("partner-fit");
    await expect(partner.getByTestId("fact")).toHaveText([
      "(supports-vertical amani-health health)",
      "(partners-with amani-health omni-university)",
      "(cohort-of cohort-2026a omni-university)",
      "(belongs-to amina-otieno cohort-2026a)",
    ]);

    await drawer.getByRole("tab", { name: "Technical view" }).click();
    const technicalPartner = drawer.getByTestId("technical-path").filter({ hasText: "partner-fit" });
    await expect(technicalPartner.getByTestId("fact")).toHaveText([
      "(supports-vertical amani-health health)",
      "(partners-with amani-health omni-university)",
      "(cohort-of cohort-2026a omni-university)",
      "(belongs-to amina-otieno cohort-2026a)",
    ]);
    const family = await technicalPartner.getByTestId("fact").first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/IBM Plex Mono|monospace/i);
  });

  test("budget change: 250 → Partial with the budget gap, its button sets 370 → Feasible", async ({ page }) => {
    await routeScenario(page, "Health pilot");
    await page.getByRole("button", { name: "Change brief" }).click();
    const form = page.getByRole("form", { name: "Venture brief" });
    await form.getByLabel("Daily budget").fill("250");
    await form.getByRole("button", { name: "Find my route" }).click();

    await expect(page.getByTestId("status-badge")).toHaveText("Partial");
    await expect(page.getByTestId("builder-card")).toHaveCount(0);
    const gap = page.getByTestId("gap");
    await expect(gap).toHaveCount(1);
    await expect(gap).toContainText("assembler.budget-fit");
    await gap.getByRole("button", { name: "Raise daily budget to USD 370" }).click();

    await expect(page.getByRole("form", { name: "Venture brief" }).getByLabel("Daily budget")).toHaveValue("370");
    await page.getByRole("button", { name: "Find my route" }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
  });

  test("form path and chat path render the same builder ids in the same order for the Agri marketplace", async ({ page }) => {
    // Form path: "Use the form instead", filled with the Agri marketplace values.
    await page.goto("/route");
    await page.getByRole("button", { name: "Use the form instead" }).click();
    const form = page.getByRole("form", { name: "Venture brief" });
    await form.getByLabel("Title").fill("Agri marketplace");
    await form.getByRole("radio", { name: "Agri" }).check({ force: true });
    for (const skill of ["Frontend", "Backend", "Domain research"]) {
      await form.getByRole("checkbox", { name: skill }).check({ force: true });
    }
    await form.getByLabel("Maximum team size").fill("3");
    await form.getByRole("button", { name: /Availability/ }).click();
    await page.getByRole("button", { name: /September 22nd, 2026/ }).first().click();
    await page.getByRole("button", { name: /September 29th, 2026/ }).first().click();
    await page.keyboard.press("Escape");
    await form.getByRole("radio", { name: "Remote" }).check({ force: true });
    await form.getByLabel("Daily budget").fill("350");
    await form.getByRole("checkbox", { name: "Prefer reusable IP" }).check();
    await form.getByRole("button", { name: "Find my route" }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
    const formIds = await builderIds(page);

    // Chat path: the Agri scenario loaded, then confirmed through POST /api/conversation.
    await page.goto("/route");
    await page.getByRole("button", { name: "Load scenario: Agri marketplace" }).click();
    await page.getByRole("button", { name: "Back to chat" }).click();
    const panel = page.getByRole("complementary", { name: "Your brief so far" });
    await panel.getByRole("button", { name: "Find my route" }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
    const chatIds = await builderIds(page);

    expect(formIds).toEqual(["fatuma-hassan", "lucy-achieng", "wanjiru-mwangi"]);
    expect(chatIds).toEqual(formIds);
  });
});
