/** PWA checks per D-32 on vite preview: manifest, service-worker controller, offline app shell. */
import { expect, test } from "@playwright/test";

test.describe("PWA (D-32)", () => {
  test("manifest carries the required fields and 192/512 icons with one maskable", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      icons: { sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe("Venture Route");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#1e5a45");
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const png = await request.get((icon as { src: string }).src);
      expect(png.status()).toBe(200);
    }
  });

  test("the service worker controls the page after a reload and the app shell renders offline", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlled).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("link", { name: "Venture Route" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The smallest credible route through BASIX.");
    await context.setOffline(false);
  });
});
