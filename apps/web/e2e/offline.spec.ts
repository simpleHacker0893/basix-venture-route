/**
 * Should line: with VITE_OFFLINE_DEMO=1 all five scenarios render their routes and the banner
 * reads "Offline demonstration mode". Served by the second preview (port 4174); the browser
 * context is offline so no engine call can succeed.
 */
import { expect, test } from "@playwright/test";

const OFFLINE_BASE = "http://localhost:4174";

const EXPECTED: [string, string][] = [
  ["Health pilot", "Feasible"],
  ["Agri marketplace", "Feasible"],
  ["Constrained brief", "Partial"],
  ["Budget challenge", "Partial"],
  ["Delivery-mode challenge", "Infeasible"],
];

test("offline demonstration mode routes the five scenarios from the snapshot with the engine unreachable", async ({ page, context }) => {
  await page.goto(`${OFFLINE_BASE}/route`);
  await expect(page.getByRole("status", { name: "Offline demonstration mode" })).toBeVisible();
  // Block every network request except the preview's own assets: the engine must not be needed.
  await context.route(/^http:\/\/localhost:8000\//, (route) => route.abort());

  for (const [label, status] of EXPECTED) {
    await page.goto(`${OFFLINE_BASE}/route`);
    await page.getByRole("button", { name: `Load scenario: ${label}` }).click();
    await page.getByRole("button", { name: "Find my route" }).click();
    await expect(page.getByTestId("status-badge")).toHaveText(status);
    await expect(page.getByRole("status", { name: "Offline demonstration mode" })).toBeVisible();
  }
});
