/** Should line: the landing page's six sections at 1440 and 1024 px without horizontal scroll. */
import { expect, test } from "@playwright/test";

for (const width of [1440, 1024]) {
  test(`landing renders all sections at ${width} px without horizontal scroll`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    for (const id of ["hero", "how-it-works", "evidence", "for-builders"]) {
      await expect(page.getByTestId(`landing-section-${id}`)).toBeVisible();
    }
    await expect(page.getByRole("contentinfo")).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

    await testInfo.attach(`landing-${width}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}
