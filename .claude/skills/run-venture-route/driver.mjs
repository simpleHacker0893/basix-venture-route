#!/usr/bin/env node
// Drives a running Venture Route (engine + Vite web app) with Playwright's Chromium.
// Uses the @playwright/test that apps/web already depends on, so no extra install.
//
//   node .claude/skills/run-venture-route/driver.mjs health
//   node .claude/skills/run-venture-route/driver.mjs route "Health pilot"
//   node .claude/skills/run-venture-route/driver.mjs shot partners      (no leading slash)
//
// Options: --base <web url> (default http://localhost:5183)
//          --api  <engine url> (default http://127.0.0.1:8010)
//          --out  <dir for screenshots> (default ./.run-shots)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(path.join(repoRoot, "apps/web/package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = opt("base", "http://localhost:5183");
const api = opt("api", "http://127.0.0.1:8010");
const out = path.resolve(opt("out", ".run-shots"));
const [cmd, arg] = args;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";

async function withPage(fn) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);
  page.on("console", (m) => m.type() === "error" && console.log("console-error:", m.text().slice(0, 200)));
  page.on("requestfailed", (r) => console.log("request-failed:", r.url(), r.failure()?.errorText));
  page.on("response", (r) => new URL(r.url()).pathname.startsWith("/api/") && console.log("api", r.status(), r.url()));
  try {
    await fn(page);
  } catch (e) {
    console.error("driver-error:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (cmd === "health") {
  const r = await fetch(`${api}/health`);
  console.log(r.status, await r.text());
  process.exit(r.ok ? 0 : 1);
} else if (cmd === "route") {
  const label = arg ?? "Health pilot";
  await withPage(async (page) => {
    await page.goto(`${base}/route`);
    await page.getByRole("button", { name: `Load scenario: ${label}` }).click();
    await page.getByRole("heading", { level: 1, name: "Confirm your brief" }).waitFor();
    await page.getByRole("button", { name: "Find my route" }).click();
    await page.getByRole("heading", { level: 1, name: "Your route through BASIX" }).waitFor();
    console.log("status:", await page.getByTestId("status-badge").innerText());
    console.log("builders:", await page.getByTestId("builder-card").getByRole("heading", { level: 3 }).allTextContents());
    const gaps = await page.getByTestId("gap").allInnerTexts();
    if (gaps.length) console.log("gaps:", gaps.map((g) => g.replace(/\s+/g, " ").slice(0, 160)));
    const file = path.join(out, `route-${slug(label)}.png`);
    await page.screenshot({ path: file });
    console.log("screenshot:", file);
  });
} else if (cmd === "shot") {
  // Pass the path without a leading slash ("partners"): Git Bash rewrites "/partners" into a Windows path.
  const target = "/" + (arg ?? "").replace(/^\/+/, "");
  await withPage(async (page) => {
    await page.goto(`${base}${target}`);
    await page.waitForLoadState("networkidle");
    const file = path.join(out, `page-${slug(target)}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("text:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400));
    console.log("screenshot:", file);
  });
} else {
  console.log("usage: driver.mjs health | route \"<scenario label>\" | shot <path> [--base url] [--api url] [--out dir]");
  process.exit(2);
}
