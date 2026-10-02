/**
 * The founder scenes F1–F8 of the video script (`docs/demo/SCRIPT.md`, #146), in story order on
 * one founder page: sign-up through the real Clerk form, the Health pilot spoken to Chloe through
 * the fake voice provider's window hook (D-51), the chip review that normalises any drift to the
 * `brief-health-01` routing fields (ruling R8), the route, "Why this route?", the change-a-
 * constraint judge moment and the publish.
 *
 * The engine runs on the real LLM provider from the root .env (ruling R6), so F2–F3 assert only
 * structure (vertical Health, Python among the skills, a budget, one of Chloe's questions); from
 * F4 on the brief equals `brief-health-01` and every assertion is exact. Serial: a failed scene
 * skips the rest, and the run fails.
 */
import { GREETING, QUESTIONS, CONSENT_CAPTION } from "../../src/chloe/script";
import { SKILL_LABELS } from "../../src/lib/brief";
import { dateRange } from "../../src/lib/format";
import { publishedRequests } from "../clerk/helpers";
import { enableVoice, spoken, tapAndSay } from "../helpers";
import { showCaption } from "./captions";
import { expect, hold, scene, test } from "./fixtures";
import { signUpThroughForm } from "./signUp";

import type { Locator, Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

/** The founder's spoken brief, verbatim from the script. It leaves out reusable IP on purpose. */
const SPOKEN_BRIEF =
  "I'm building Health pilot: triage assistant for community clinics. It's for the health vertical. " +
  "I need Python, AI / MeTTa and UI/UX design skills, with at most 3 builders. The work runs from " +
  "22 September 2026 to 29 September 2026, hybrid, and my budget is 400 US dollars a day.";

/** The routing fields of `brief-health-01`, which F4 restores on camera. */
const HEALTH_PILOT = {
  title: "Health pilot: triage assistant for community clinics",
  vertical: "Health",
  skills: ["Python", "AI / MeTTa", "UI/UX design"],
  maximumTeamSize: "3",
  availability: dateRange("2026-09-22", "2026-09-29"),
  mode: "Hybrid",
  dailyBudget: "400",
} as const;

const HEALTH_PILOT_SKILLS: ReadonlySet<string> = new Set(HEALTH_PILOT.skills);

const ROUTE_TIMEOUT = 60_000;

function briefFields(page: Page): Locator {
  return page.getByRole("complementary", { name: "Your brief so far" }).getByRole("list", { name: "Brief fields" });
}

function chip(fields: Locator, label: string): Locator {
  return fields.getByRole("listitem").filter({ hasText: `${label}:` });
}

async function routeHeading(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeVisible({
    timeout: ROUTE_TIMEOUT,
  });
}

async function setChecked(control: Locator, checked: boolean): Promise<void> {
  if ((await control.isChecked()) !== checked) await control.setChecked(checked, { force: true });
}

/** Corrects every routing field that drifted from `brief-health-01`; a field that matches is left alone. */
async function normaliseToHealthPilot(page: Page, form: Locator): Promise<void> {
  const title = form.getByLabel("Title");
  if ((await title.inputValue()) !== HEALTH_PILOT.title) await title.fill(HEALTH_PILOT.title);
  await setChecked(form.getByRole("radio", { name: HEALTH_PILOT.vertical }), true);
  for (const label of Object.values(SKILL_LABELS)) {
    await setChecked(form.getByRole("checkbox", { name: label, exact: true }), HEALTH_PILOT_SKILLS.has(label));
  }
  const teamSize = form.getByLabel("Maximum team size");
  if ((await teamSize.inputValue()) !== HEALTH_PILOT.maximumTeamSize) await teamSize.fill(HEALTH_PILOT.maximumTeamSize);

  const availability = form.getByRole("button", { name: /Availability/ });
  // A click on a complete range may start a new one or move one end, so retry until it reads right.
  for (let attempt = 0; attempt < 3 && (await availability.textContent()) !== HEALTH_PILOT.availability; attempt += 1) {
    await availability.click();
    await page.getByRole("button", { name: /September 22nd, 2026/ }).first().click();
    await page.getByRole("button", { name: /September 29th, 2026/ }).first().click();
    await page.keyboard.press("Escape");
  }
  await expect(availability).toHaveText(HEALTH_PILOT.availability);

  await setChecked(form.getByRole("radio", { name: HEALTH_PILOT.mode }), true);
  const budget = form.getByLabel("Daily budget");
  if ((await budget.inputValue()) !== HEALTH_PILOT.dailyBudget) await budget.fill(HEALTH_PILOT.dailyBudget);
  // The one field the spoken brief left out: Chloe asked for it in F3.
  await setChecked(form.getByRole("checkbox", { name: "Prefer reusable IP" }), true);
}

scene("F1", "founder", async (page) => {
  await signUpThroughForm(page, "founder");
  await hold(page, 2_500);
});

scene("F2", "founder", async (page) => {
  await expect(page.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeVisible();
  await enableVoice(page);
  await expect(page.getByRole("main").getByRole("switch", { name: "Voice: Chloe" })).toBeChecked();
  await expect(page.getByText(CONSENT_CAPTION).first()).toBeVisible();
  await expect.poll(async () => (await spoken(page))[0]).toBe(GREETING);
  // Playwright video has no audio: Chloe's replies and the founder's words are captions.
  await showCaption(page, `Chloe: “${GREETING}”`);
  await hold(page, 3_000);

  await showCaption(page, `Founder: “${SPOKEN_BRIEF}”`);
  const [response] = await Promise.all([
    page.waitForResponse(
      (answer) => answer.url().endsWith("/api/conversation") && answer.request().method() === "POST",
      { timeout: ROUTE_TIMEOUT },
    ),
    tapAndSay(page, SPOKEN_BRIEF),
  ]);
  expect(((await response.json()) as { type: string }).type).toBe("clarification");

  const fields = briefFields(page);
  await expect(chip(fields, "Vertical")).toContainText("Health");
  await expect(chip(fields, "Skills")).toContainText("Python");
  await expect(chip(fields, "Budget")).toBeVisible();
  await expect(chip(fields, "Budget")).not.toContainText("missing");
  await hold(page, 3_000);
});

scene("F3", "founder", async (page) => {
  const questions: string[] = Object.values(QUESTIONS);
  await expect
    .poll(async () => questions.includes((await spoken(page)).at(-1) ?? ""), { timeout: 30_000 })
    .toBe(true);
  const question = (await spoken(page)).at(-1) ?? "";
  await showCaption(page, `Chloe: “${question}”`);
  await expect(briefFields(page).getByText("missing", { exact: true }).first()).toBeVisible();
  await hold(page, 4_000);
});

scene("F4", "founder", async (page) => {
  // Leaving the chat for the form ends voice mode (D-55); the form opens on the extracted brief.
  await page.getByRole("button", { name: "Use the form instead", exact: true }).click();
  const form = page.getByRole("form", { name: "Venture brief" });
  await expect(form).toBeVisible();
  await expect(form.getByRole("radio", { name: "Health" })).toBeChecked();
  await expect(form.getByRole("checkbox", { name: "Python", exact: true })).toBeChecked();
  await expect(form.getByLabel("Daily budget")).not.toHaveValue("");
  await hold(page, 1_500);

  await normaliseToHealthPilot(page, form);
  for (const label of Object.values(SKILL_LABELS)) {
    const checkbox = form.getByRole("checkbox", { name: label, exact: true });
    if (HEALTH_PILOT_SKILLS.has(label)) await expect(checkbox).toBeChecked();
    else await expect(checkbox).not.toBeChecked();
  }
  await expect(form.getByRole("radio", { name: "Hybrid" })).toBeChecked();
  await expect(form.getByLabel("Daily budget")).toHaveValue("400");
  await expect(form.getByRole("checkbox", { name: "Prefer reusable IP" })).toBeChecked();
  await hold(page, 2_000);

  await form.getByRole("button", { name: "Find my route" }).click();
  await routeHeading(page);
  await hold(page, 1_500);
});

scene("F5", "founder", async (page) => {
  await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
  const cards = page.getByTestId("builder-card");
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText(["Amina Otieno", "Daniel Kiptoo", "Grace Wambui"]);
  await expect(cards.getByTestId("evidence-badge")).toHaveText(["Both", "Both", "Credential"]);
  for (let i = 0; i < 3; i += 1) await expect(cards.nth(i).getByText("Demo data")).toBeVisible();
  await expect(page.getByTestId("cost-strip")).toContainText("USD 370 / day");
  await cards.first().scrollIntoViewIfNeeded();
  await hold(page, 2_500);
  await expect(page.getByTestId("ip-card")).toContainText("asset-afya-triage");
  await expect(page.getByTestId("partner-card")).toContainText("amani-health");
  await page.getByTestId("partner-card").scrollIntoViewIfNeeded();
  await hold(page, 2_500);
  await page.getByRole("heading", { level: 1, name: "Your route through BASIX" }).scrollIntoViewIfNeeded();
});

const PARTNER_FACTS = [
  "(supports-vertical amani-health health)",
  "(partners-with amani-health omni-university)",
  "(cohort-of cohort-2026a omni-university)",
  "(belongs-to amina-otieno cohort-2026a)",
];

scene("F6", "founder", async (page) => {
  await page.getByRole("button", { name: "Why this route?" }).click();
  const drawer = page.getByRole("dialog", { name: "Why this route?" });
  await expect(drawer).toBeVisible();
  const partner = drawer.getByTestId("path-partner");
  await expect(partner).toContainText("partner-fit");
  await expect(partner.getByTestId("fact")).toHaveText(PARTNER_FACTS);
  await partner.scrollIntoViewIfNeeded();
  await hold(page, 3_000);

  await drawer.getByRole("tab", { name: "Technical view" }).click();
  const technicalPartner = drawer.getByTestId("technical-path").filter({ hasText: "partner-fit" });
  await expect(technicalPartner.getByTestId("fact")).toHaveText(PARTNER_FACTS);
  const family = await technicalPartner.getByTestId("fact").first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/IBM Plex Mono|monospace/i);
  await technicalPartner.scrollIntoViewIfNeeded();
  await hold(page, 3_000);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

/** "Change brief" → the review form → `change` → "Find my route" → the new route. */
async function reroute(page: Page, change: (form: Locator) => Promise<void>): Promise<void> {
  await page.getByRole("button", { name: "Change brief" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
  const form = page.getByRole("form", { name: "Venture brief" });
  await change(form);
  await hold(page, 1_200);
  await form.getByRole("button", { name: "Find my route" }).click();
  await routeHeading(page);
}

scene("F7", "founder", async (page) => {
  // (a) Add Mobile: no confirmed builder proves it, so route-gap names it above the same team.
  await reroute(page, (form) => form.getByRole("checkbox", { name: "Mobile", exact: true }).check({ force: true }));
  await expect(page.getByTestId("status-badge")).toHaveText("Partial");
  const gapsBeforeTeam = await page.evaluate(() => {
    const gaps = document.querySelector('[data-testid="gaps-panel"]');
    const team = document.querySelector('[data-testid="team-section"]');
    return !!gaps && !!team && !!(gaps.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(gapsBeforeTeam).toBe(true);
  const gaps = page.getByTestId("gap");
  await expect(gaps).toHaveCount(1);
  await expect(gaps.first()).toContainText("route-gap");
  await expect(gaps.first()).toContainText("mobile");
  await expect(page.getByTestId("builder-card")).toHaveCount(3);
  await page.getByTestId("gaps-panel").scrollIntoViewIfNeeded();
  await hold(page, 3_000);

  // (b) Drop Mobile, budget 250: no affordable team, so no card is shown (D-22).
  await reroute(page, async (form) => {
    await form.getByRole("checkbox", { name: "Mobile", exact: true }).uncheck({ force: true });
    await form.getByLabel("Daily budget").fill("250");
  });
  await expect(page.getByTestId("status-badge")).toHaveText("Partial");
  await expect(page.getByTestId("builder-card")).toHaveCount(0);
  const budgetGap = page.getByTestId("gap");
  await expect(budgetGap).toHaveCount(1);
  await expect(budgetGap).toContainText("assembler.budget-fit");
  await budgetGap.scrollIntoViewIfNeeded();
  await hold(page, 3_000);

  // (c) The gap's own next action sets 370, and the route is Feasible again.
  await budgetGap.getByRole("button", { name: "Raise daily budget to USD 370" }).click();
  const form = page.getByRole("form", { name: "Venture brief" });
  await expect(form.getByLabel("Daily budget")).toHaveValue("370");
  await hold(page, 1_200);
  await form.getByRole("button", { name: "Find my route" }).click();
  await routeHeading(page);
  await expect(page.getByTestId("status-badge")).toHaveText("Feasible");
  await hold(page, 2_500);
});

scene("F8", "founder", async (page) => {
  await page.getByRole("button", { name: "Publish as request" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  const request = publishedRequests(page).filter({ hasText: "Health pilot" }).first();
  await expect(request).toContainText("Open");
  await request.scrollIntoViewIfNeeded();
  await hold(page, 2_500);
});
