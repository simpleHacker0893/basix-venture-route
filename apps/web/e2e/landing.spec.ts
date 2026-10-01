/**
 * Should line: the landing page's sections, the Hackathon partners section and the footer at
 * 1440, 1024 and the phone widths 430, 390 and 360 px without horizontal scroll; the footer's
 * "Hackathon partners" link scrolls to the section from the landing page and from another route.
 */
import { expect, test } from "@playwright/test";

for (const width of [1440, 1024, 430, 390, 360]) {
  test(`landing renders all sections at ${width} px without horizontal scroll`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    for (const id of ["hero", "how-it-works", "evidence", "for-builders", "hackathon-partners"]) {
      await expect(page.getByTestId(`landing-section-${id}`)).toBeVisible();
    }
    const partners = page.getByTestId("landing-section-hackathon-partners");
    await expect(partners.getByRole("heading", { level: 2, name: "Built with the BASIX ecosystem." })).toBeVisible();
    await expect(partners.getByRole("link")).toHaveCount(9);
    await expect(partners.getByText("Blockwee")).toBeVisible();

    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Hackathon partners" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Ecosystem partners (demo)" })).toBeVisible();

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

test("the footer's Hackathon partners link scrolls to the section from the landing page", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("landing-section-hackathon-partners");
  await page.getByRole("contentinfo").getByRole("link", { name: "Hackathon partners" }).click();
  await expect(page).toHaveURL(/\/#hackathon-partners$/);
  await expect(section).toBeInViewport();
});

test("the footer's Hackathon partners link takes you from another page to the section", async ({ page }) => {
  await page.goto("/privacy");
  await page.getByRole("contentinfo").getByRole("link", { name: "Hackathon partners" }).click();
  await expect(page).toHaveURL(/\/#hackathon-partners$/);
  await expect(page.getByTestId("landing-section-hackathon-partners")).toBeInViewport();
});
