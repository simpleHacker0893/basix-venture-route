/**
 * Sprint 005a acceptance, Playwright lines against `vite preview` with the engine calls to
 * `/api/showcase*` stubbed through `page.route` (the gallery and detail pages are pure renderers
 * of whatever the engine answers, AGENTS.md rule 1, so a deterministic fixture is enough here;
 * the Clerk suite, e2e/clerk/showcase.spec.ts, exercises the real round trip). Nothing else on
 * the page is stubbed: the header, routing and the rest of the app run against the real build.
 */
import type { ShowcaseCard, ShowcaseDetail, ShowcasePage } from "@venture-route/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const BASE_CARD: ShowcaseCard = {
  id: "demo-venture-route",
  title: "Venture Route",
  builderId: "demo-njuguna-njenga",
  displayName: "Njuguna Njenga",
  cohortId: null,
  vertical: "education",
  licensable: false,
  description: "Turns a founder's venture brief into a staffing route.",
  skillIds: ["ai-metta", "python"],
  matchedSkill: null,
  liveUrl: "https://example.org/venture-route/live",
  demoUrl: "https://example.org/venture-route/demo",
  pitchVideoUrl: null,
  pitchDeckUrl: "https://example.org/venture-route/deck",
  pitchVideoId: null,
  demoData: true,
};

const SECOND_CARD: ShowcaseCard = {
  ...BASE_CARD,
  id: "demo-school-fees-tracker",
  title: "School fees tracker",
  builderId: "demo-imani-kariuki",
  displayName: "Imani Kariuki",
  vertical: "education",
  licensable: true,
  skillIds: ["frontend", "ui-ux"],
  liveUrl: null,
  demoUrl: "https://example.org/school-fees-tracker/demo",
  pitchDeckUrl: null,
};

function pageOf(items: ShowcaseCard[]): ShowcasePage {
  return { items, total: items.length };
}

const DETAIL: ShowcaseDetail = {
  id: "demo-venture-route",
  title: "Venture Route",
  vertical: "education",
  licensable: false,
  description: "Turns a founder's venture brief into a staffing route.",
  completedOn: "2026-09-22",
  skillIds: ["ai-metta", "python"],
  liveUrl: "https://example.org/venture-route/live",
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

/** Every request this test observed against `/api/showcase*`, in order, path + query only. */
function recordRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/showcase")) seen.push(url.pathname + url.search);
  });
  return seen;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Stubs the list endpoint: `?skill=` answers a chip-matched card, `licensable=true` answers only
 * the licensable card, everything else answers both cards. The detail endpoint answers `DETAIL`
 * for its id and a 404 for anything else. */
async function stubShowcase(page: Page) {
  await page.route("**/api/showcase**", async (route) => {
    const url = new URL(route.request().url());
    if (/\/api\/showcase\/[^/?]+$/.test(url.pathname)) {
      const projectId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      if (projectId === DETAIL.id) return fulfillJson(route, DETAIL);
      return fulfillJson(route, { detail: "no such showcase entry" }, 404);
    }
    const skill = url.searchParams.get("skill");
    if (skill) {
      const matched: ShowcaseCard = {
        ...BASE_CARD,
        matchedSkill: { id: skill, label: skill, kind: "verified" },
      };
      return fulfillJson(route, pageOf([matched]));
    }
    if (url.searchParams.get("licensable") === "true") {
      return fulfillJson(route, pageOf([SECOND_CARD]));
    }
    return fulfillJson(route, pageOf([BASE_CARD, SECOND_CARD]));
  });
}

test.describe("Showcase gallery: no sign-in needed", () => {
  test.beforeEach(async ({ page }) => {
    await stubShowcase(page);
  });

  test("the header carries a Showcase link on desktop that opens the gallery", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Showcase" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/showcase$/);
  });

  test("the mobile menu carries a Showcase link", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Showcase" })).toBeVisible();
  });

  test("the gallery renders cards with the Demo data pill and no YouTube content before any click", async ({ page }) => {
    await page.goto("/showcase");

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "Venture Route" })).toBeVisible();
    await expect(cards.filter({ hasText: "School fees tracker" })).toBeVisible();
    for (let i = 0; i < 2; i += 1) await expect(cards.nth(i).getByText("Demo data")).toBeVisible();

    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator('img[src*="youtube"], img[src*="ytimg"]')).toHaveCount(0);
  });

  test("filtering by a skill chip sends skill=<id> and shows the filtered cards", async ({ page }) => {
    const requests = recordRequests(page);
    await page.goto("/showcase");
    await expect(page.getByRole("article")).toHaveCount(2);

    await page.getByRole("group", { name: "Skill" }).getByRole("button", { name: "Python" }).click();

    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByTestId("matched-skill-chip")).toHaveText("python · Verified");
    expect(requests.at(-1)).toContain("skill=python");
  });

  test("the Licensable toggle off omits the param", async ({ page }) => {
    const requests = recordRequests(page);
    await page.goto("/showcase");
    await expect(page.getByRole("article")).toHaveCount(2);

    const toggle = page.getByRole("checkbox", { name: "Licensable IP" });
    await toggle.check();
    await expect(page.getByRole("article")).toHaveCount(1);
    expect(requests.at(-1)).toContain("licensable=true");

    await toggle.uncheck();
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(requests.at(-1)).not.toContain("licensable");
  });

  test("every external link on the gallery has rel=noopener noreferrer", async ({ page }) => {
    await page.goto("/showcase");
    const links = page.locator('a[target="_blank"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

test.describe("Showcase detail: PitchVideo facade and 404", () => {
  test.beforeEach(async ({ page }) => {
    await stubShowcase(page);
  });

  test("no iframe until 'Play pitch', then an iframe whose src is the youtube-nocookie embed", async ({ page }) => {
    await page.goto(`/showcase/${DETAIL.id}`);
    await expect(page.getByRole("heading", { level: 1, name: DETAIL.title })).toBeVisible();

    await expect(page.locator("iframe")).toHaveCount(0);
    await page.getByRole("button", { name: "Play pitch" }).click();

    const iframe = page.locator("iframe");
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${DETAIL.pitchVideoId}?autoplay=1`);
  });

  test("every external link on the detail page has rel=noopener noreferrer", async ({ page }) => {
    await page.goto(`/showcase/${DETAIL.id}`);
    await expect(page.getByRole("heading", { level: 1, name: DETAIL.title })).toBeVisible();

    const links = page.locator('a[target="_blank"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("a 404 detail shows \"This project isn't on the Showcase.\"", async ({ page }) => {
    await page.goto("/showcase/not-a-real-project");
    await expect(page.getByRole("heading", { level: 1, name: "This project isn't on the Showcase." })).toBeVisible();
  });
});
