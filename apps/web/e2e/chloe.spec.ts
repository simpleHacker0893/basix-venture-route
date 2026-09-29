/**
 * Sprint 006 acceptance, Playwright lines against `vite preview` built with
 * `VITE_VOICE_PROVIDER=fake` (Must 9, Must 10) and against the offline preview (Must 10). The
 * engine runs with `LLM_PROVIDER=null` (D-33); Chloe never decides anything, so nothing here
 * needs a real key.
 */
import { expect, test } from "@playwright/test";

import { GREETING } from "../src/chloe/script";
import { builderIds, enableVoice, holdAndSay, spoken } from "./helpers";

test.describe("Chloe: voice routes the Agri marketplace exactly like the form", () => {
  test("voice path deep-equals the form path's POST /api/route body, same builder ids in order; spoken() starts with the greeting", async ({
    page,
  }) => {
    // Form path: the Agri marketplace scenario confirmed on the review screen, which posts the
    // scenario brief unchanged to POST /api/route (the same BriefEditor a manual fill submits).
    await page.goto("/route");
    await page.getByRole("button", { name: "Load scenario: Agri marketplace" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
    const [formResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/route") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Find my route" }).click(),
    ]);
    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
    const formRoute = await formResponse.json();
    const formIds = await builderIds(page);

    // Voice path: the same scenario, back to the chat screen, "go ahead" through the fake mic.
    await page.goto("/route");
    await enableVoice(page);
    await page.getByRole("button", { name: "Load scenario: Agri marketplace" }).click();
    await page.getByRole("button", { name: "Back to chat" }).click();
    // The read-back's confirmation prompt is the cue that Chloe is ready for "go ahead".
    await expect(page.getByText("Shall I find your route?")).toBeVisible();

    const [conversationResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith("/api/conversation") && response.request().method() === "POST",
      ),
      holdAndSay(page, "go ahead"),
    ]);
    await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
    const conversationJson = await conversationResponse.json();
    const chatIds = await builderIds(page);

    expect(conversationJson.type).toBe("route");
    expect(conversationJson.route).toEqual(formRoute);
    expect(chatIds).toEqual(formIds);

    const lines = await spoken(page);
    expect(lines[0]).toBe(GREETING);
  });
});

test.describe("Chloe: the offline preview has no voice switch", () => {
  test("no 'Voice: Chloe' switch on the offline preview", async ({ page }) => {
    await page.goto("http://localhost:4174/route");
    await expect(page.getByRole("switch", { name: "Voice: Chloe" })).toHaveCount(0);
  });
});

test.describe("Chloe: consent caption and the speaking indicator", () => {
  test("the consent caption is present once voice is on", async ({ page }) => {
    await page.goto("/route");
    await enableVoice(page);
    await expect(page.getByText(/sends your audio to Google/)).toBeVisible();
  });
});
