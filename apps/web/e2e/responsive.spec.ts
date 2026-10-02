/**
 * Regression guard for phones and tablets: every public page and the founder's routing flow must
 * fit the viewport at 320, 375, 390, 768 and 1440 px with no horizontal page scroll. A page that
 * grows a fixed width, a nowrap row or an unbroken string wider than the screen fails here with
 * the page name, width and the widest offending element.
 *
 * The signed-in pages (builder home, My showcase, Profile, Add project, Requests, dashboard,
 * booking, admin) sit behind Clerk and cannot render in this no-key suite; they are checked with
 * the local preview harness instead (see the PR description).
 */
import type { ShowcaseCard, ShowcaseDetail, ShowcasePage } from "@venture-route/contracts";
import { expect, test, type Page } from "@playwright/test";

import { routeScenario } from "./helpers";

const WIDTHS = [320, 375, 390, 768, 1440] as const;

const CARD: ShowcaseCard = {
  id: "demo-venture-route",
  title: "Venture Route: a deliberately long project title to prove it wraps instead of overflowing",
  builderId: "demo-njuguna-njenga",
  displayName: "Njuguna Njenga",
  cohortId: null,
  vertical: "education",
  licensable: true,
  description: "Turns a founder's venture brief into a staffing route.",
  skillIds: ["ai-metta", "python", "frontend", "backend"],
  matchedSkill: null,
  liveUrl: "https://example.org/venture-route/live",
  demoUrl: "https://example.org/venture-route/demo",
  pitchVideoUrl: null,
  pitchDeckUrl: "https://example.org/venture-route/deck",
  pitchVideoId: null,
  demoData: true,
};

const DETAIL: ShowcaseDetail = {
  id: CARD.id,
  title: CARD.title,
  vertical: "education",
  licensable: true,
  description: "Turns a founder's venture brief into a staffing route. ".repeat(6),
  completedOn: "2026-09-22",
  skillIds: CARD.skillIds,
  liveUrl: "https://example.org/venture-route/live/with/a/very/long/path/that/keeps/going/and/going/and/going",
  demoUrl: "https://example.org/venture-route/demo",
  pitchVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
  pitchDeckUrl: "https://example.org/venture-route/deck",
  pitchVideoId: "dQw4w9WgXcQ",
  builder: {
    builderId: "demo-njuguna-njenga",
    displayName: "Njuguna Njenga",
    cohortId: null,
    verifiedSkills: [],
    skillSet: [],
    certifications: [],
    githubUrl: "https://github.com/njuguna",
    linkedinUrl: "https://www.linkedin.com/in/njuguna",
  },
  demoData: true,
};

async function stubShowcase(page: Page) {
  await page.route("**/api/showcase**", async (route) => {
    const url = new URL(route.request().url());
    const body: ShowcasePage | ShowcaseDetail = /\/api\/showcase\/[^/?]+$/.test(url.pathname)
      ? DETAIL
      : { items: [CARD, { ...CARD, id: "demo-two" }], total: 2 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

/** Measures the page and, when it overflows, names the widest offender so the failure is actionable. */
async function overflowOf(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth <= vw) return null;
    let worst = "";
    let right = 0;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.right > right) {
        right = r.right;
        const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".");
        worst = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} right=${Math.round(r.right)}`;
      }
    }
    return `scrollWidth ${scrollWidth} > ${vw}; widest: ${worst}`;
  });
}

const PAGES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: "landing", open: async (page) => void (await page.goto("/")) },
  { name: "route form", open: async (page) => void (await page.goto("/route")) },
  {
    name: "route review",
    open: async (page) => {
      await page.goto("/route");
      await page.getByRole("button", { name: /Load scenario/ }).first().click();
      await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
    },
  },
  { name: "route result", open: async (page) => routeScenario(page, "Health pilot") },
  {
    name: "route result with Why this route?",
    open: async (page) => {
      await routeScenario(page, "Health pilot");
      await page.getByRole("button", { name: /Why this route/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "handoff",
    open: async (page) => {
      await routeScenario(page, "Health pilot");
      await page.getByRole("link", { name: "Export handoff" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Venture handoff" })).toBeVisible();
    },
  },
  { name: "partners", open: async (page) => void (await page.goto("/partners")) },
  { name: "showcase gallery", open: async (page) => void (await page.goto("/showcase")) },
  { name: "showcase detail", open: async (page) => void (await page.goto(`/showcase/${CARD.id}`)) },
  { name: "privacy", open: async (page) => void (await page.goto("/privacy")) },
  { name: "sign-in", open: async (page) => void (await page.goto("/sign-in")) },
  { name: "sign-up", open: async (page) => void (await page.goto("/sign-up")) },
  { name: "choose role", open: async (page) => void (await page.goto("/choose-role")) },
];

for (const width of WIDTHS) {
  test(`no horizontal scroll at ${width} px on any public page`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width <= 430 ? 800 : 900 });
    await stubShowcase(page);

    const failures: string[] = [];
    for (const { name, open } of PAGES) {
      await open(page);
      await page.waitForTimeout(250);
      const overflow = await overflowOf(page);
      if (overflow) failures.push(`${name}: ${overflow}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
