/**
 * The hook (#145 tracer scene): the landing page with the one-line promise as its caption.
 */
import { CAPTION_ID } from "./captions";
import { expect, hold, scene } from "./fixtures";
import { SCENES } from "./scenes";

scene("H1", async (page) => {
  await page.goto("/");
  await expect(page.getByTestId("landing-section-hero")).toBeVisible();
  await expect(page.locator(`#${CAPTION_ID}`)).toHaveText(SCENES.H1);
  await expect(page.locator(`#${CAPTION_ID}`)).toBeVisible();
  await hold(page, 4_000);
});
