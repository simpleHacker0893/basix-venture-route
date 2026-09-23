import { expect, type Page } from "@playwright/test";

/** Load a seed scenario chip, confirm it on the review step, and wait for the route screen. */
export async function routeScenario(page: Page, label: string) {
  await page.goto("/route");
  await page.getByRole("button", { name: `Load scenario: ${label}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
  await page.getByRole("button", { name: "Find my route" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeVisible();
}

export async function builderNames(page: Page): Promise<string[]> {
  return page.getByTestId("builder-card").getByRole("heading", { level: 3 }).allTextContents();
}

export async function builderIds(page: Page): Promise<string[]> {
  return page.getByTestId("builder-card").getByTestId("builder-id").allTextContents();
}
