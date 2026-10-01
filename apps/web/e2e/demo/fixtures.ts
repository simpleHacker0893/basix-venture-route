/**
 * `scene(id, body)`: one test per scene of the video script. Around the body, the harness puts
 * the scene's caption on screen, and afterwards closes the page so Playwright finishes its
 * video, copies it to `demo-output/clips/<id>.webm` and checks the clip is 1920×1080. A scene
 * whose assertions fail fails the run: a flaky take never counts (#143).
 */
import { rmSync } from "node:fs";

import { test as base, expect, type Page } from "@playwright/test";

import { installCaptions, showCaption } from "./captions";
import { clipPath, VIDEO_SIZE, webmSize } from "./clips";
import { SCENES, type SceneId } from "./scenes";

const SCENE = "scene";

const test = base.extend<{ sceneClip: void }>({
  sceneClip: [
    async ({ page }, use, testInfo) => {
      const id = testInfo.annotations.find((note) => note.type === SCENE)?.description as SceneId | undefined;
      if (!id || !(id in SCENES)) throw new Error("every demo test is a scene(): declare it with scene(id, body)");
      const target = clipPath(id);
      rmSync(target, { force: true });
      await installCaptions(page);
      await showCaption(page, SCENES[id]);

      await use();

      const video = page.video();
      if (!video) throw new Error("the demo project records video: set use.video in playwright.demo.config.ts");
      await page.close();
      await video.saveAs(target);
      expect(webmSize(target), `${id}.webm frame size`).toEqual(VIDEO_SIZE);
    },
    { auto: true },
  ],
});

export function scene(id: SceneId, body: (page: Page) => Promise<void>): void {
  test(`${id}: ${SCENES[id]}`, { annotation: { type: SCENE, description: id } }, async ({ page }) => {
    await body(page);
  });
}

/** Keeps the frame on screen so the clip has time for its caption and voiceover. */
export async function hold(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

export { expect };
