// Captures the README screenshots from a running engine's Swagger UI.
// Usage: start the engine with ENGINE_DEV_QUERY=1, then
//   npm install --no-save playwright && node scripts/capture-readme-screenshots.mjs
// ENGINE_URL (default http://localhost:8000), OUT_DIR (default docs/images) and
// SWAGGER_UI_DIST (path to an unpacked swagger-ui-dist package) are optional.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const OUT_DIR = process.env.OUT_DIR ?? "docs/images";

async function tryItOut(page, opblockId, body) {
  const op = page.locator(`#${opblockId}`);
  await op.locator(".opblock-summary").click();
  await op.getByRole("button", { name: "Try it out" }).click();
  if (body) await op.locator("textarea.body-param__text").fill(body);
  await op.getByRole("button", { name: "Execute" }).click();
  await op.locator(".live-responses-table .response-col_status").first().waitFor();
  return op;
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

// Offline or locked-down networks: serve Swagger UI from a local swagger-ui-dist copy instead of the CDN.
if (process.env.SWAGGER_UI_DIST) {
  await page.route("https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/**", (route) =>
    route.fulfill({ path: `${process.env.SWAGGER_UI_DIST}/${new URL(route.request().url()).pathname.split("/").pop()}` }),
  );
}

await page.goto(`${ENGINE_URL}/docs`);
await page.locator(".opblock").first().waitFor();
// Show whole response bodies (Swagger UI caps them at 400px).
await page.addStyleTag({
  content: ".responses-inner .microlight { max-height: none !important; }",
});
await page.screenshot({ path: `${OUT_DIR}/engine-api-overview.png` });

const health = await tryItOut(page, "operations-default-health_health_get");
await health.locator(".live-responses-table .response-col_description .highlight-code").first().screenshot({ path: `${OUT_DIR}/engine-health.png` });
await health.locator(".opblock-summary").click();

const query = await tryItOut(
  page,
  "operations-internal-query_internal_query_post",
  JSON.stringify({ briefId: "brief-constrained-01" }, null, 2),
);
await query.locator(".live-responses-table .response-col_description .highlight-code").first().screenshot({ path: `${OUT_DIR}/engine-internal-query.png` });

await browser.close();
console.log(`Screenshots written to ${OUT_DIR}/`);
