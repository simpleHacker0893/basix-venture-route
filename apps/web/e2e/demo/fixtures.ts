/**
 * `scene(id, role, body)`: one test per scene of the video script (#143, #145, #146).
 *
 * The recording model:
 * - **One browser context and one page per role** (`visitor`, `founder`, `builder`, `admin`),
 *   opened on the role's first scene and kept for the whole worker. Consecutive scenes of a role
 *   continue on the same page, so in-memory app state (Chloe's conversation, the routed brief)
 *   carries over, and a signed-in role is never signed in again on camera.
 * - **Clerk session persisted per role.** After every passing scene the role's `storageState`
 *   is written to `<outputDir>/roles/<role>.json`. If the role's page has to be opened again (a
 *   new worker), the context starts from that file and the role resumes signed in.
 * - **One clip per scene, from that scene's page.** Each scene records its own screencast of the
 *   role's page (`page.screencast`, 1920×1080) into the test's output dir. Only a scene whose
 *   body passed, and whose clip and every captured frame are 1920×1080, copies it to
 *   `demo-output/clips/<clip>.webm`: a failed or timed-out scene never writes or overwrites its
 *   clip, and never advances the role's saved session. A failure fails the run: a flaky take
 *   never counts.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base, expect, type Browser, type Page } from "@playwright/test";

import { OUTPUT_DIR, WEB_URL } from "../clerk/env";
import { installCaptions, showCaption } from "./captions";
import { clipPath, CLIPS_DIR, jpegSize, VIDEO_SIZE, webmSize } from "./clips";
import { SCENES, type SceneId, type SceneRole } from "./scenes";

const ROLE_STATE_DIR = path.join(OUTPUT_DIR, "roles");

function roleStatePath(role: SceneRole): string {
  return path.join(ROLE_STATE_DIR, `${role}.json`);
}

/** The run's role pages: opened lazily, closed when the worker ends. */
class RolePages {
  private readonly pages = new Map<SceneRole, Page>();
  private readonly browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  async page(role: SceneRole): Promise<Page> {
    const open = this.pages.get(role);
    if (open && !open.isClosed()) return open;
    const saved = roleStatePath(role);
    const context = await this.browser.newContext({
      baseURL: WEB_URL,
      viewport: VIDEO_SIZE,
      storageState: role !== "visitor" && existsSync(saved) ? saved : undefined,
    });
    // Clerk's bot-protection bypass for every Frontend API call on this context (the sign-up form).
    await setupClerkTestingToken({ context });
    const page = await context.newPage();
    await installCaptions(page);
    this.pages.set(role, page);
    return page;
  }

  /** Saves the role's Clerk session (cookies and local storage) for a later context. */
  async persist(role: SceneRole): Promise<void> {
    const page = this.pages.get(role);
    if (role === "visitor" || !page) return;
    mkdirSync(ROLE_STATE_DIR, { recursive: true });
    await page.context().storageState({ path: roleStatePath(role) });
  }

  async closeAll(): Promise<void> {
    for (const page of this.pages.values()) await page.context().close();
    this.pages.clear();
  }
}

const test = base.extend<object, { rolePages: RolePages }>({
  rolePages: [
    async ({ browser }, use) => {
      const pages = new RolePages(browser);
      await use(pages);
      await pages.closeAll();
    },
    { scope: "worker" },
  ],
});

export function scene(id: SceneId, role: SceneRole, body: (page: Page) => Promise<void>): void {
  const { clip, caption } = SCENES[id];
  test(`${id}: ${caption}`, async ({ rolePages }, testInfo) => {
    const page = await rolePages.page(role);
    await showCaption(page, caption);
    const draft = testInfo.outputPath(`${clip}.webm`);
    // The frames' own size: the page's screencast is shared, and its first client sets the size.
    const frameSizes = new Set<string>();
    await page.screencast.start({
      path: draft,
      size: VIDEO_SIZE,
      onFrame: ({ data }) => {
        const size = jpegSize(data);
        frameSizes.add(`${size.width}x${size.height}`);
      },
    });
    try {
      await body(page);
    } finally {
      await page.screencast.stop();
    }
    // Reached only when the body passed.
    expect(webmSize(draft), `${clip}.webm frame size`).toEqual(VIDEO_SIZE);
    expect([...frameSizes], `${clip} captured frame sizes`).toEqual([`${VIDEO_SIZE.width}x${VIDEO_SIZE.height}`]);
    mkdirSync(CLIPS_DIR, { recursive: true });
    copyFileSync(draft, clipPath(clip));
    await rolePages.persist(role);
  });
}

/** Keeps the frame on screen so the clip has time for its caption and voiceover. */
export async function hold(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

export { expect, test };
