import { expect, type Page } from "@playwright/test";

/**
 * The shape `installWindowHook` publishes on a `VITE_VOICE_PROVIDER=fake` build
 * (`apps/web/src/voice/fakeVoiceProvider.ts`). Playwright never touches a real microphone or
 * speaker: it drives Chloe entirely through this hook.
 */
type ChloeVoiceWindowHook = {
  spoken(): string[];
  transcribe(text: string): void;
  fail(code: string): void;
  finishSpeaking(): void;
};

declare global {
  interface Window {
    __chloeVoice?: ChloeVoiceWindowHook;
  }
}

/** Turns the "Voice: Chloe" switch on (Sprint 006 blueprint `enableVoice`). Scoped to the main
 * region: a signed-in founder also has the top-nav switch (#102), but the no-key suite runs
 * signed out, where the intake header's switch is the only one on screen. */
export async function enableVoice(page: Page) {
  await page.getByRole("main").getByRole("switch", { name: "Voice: Chloe" }).click();
}

/**
 * Push-to-talk through the fake provider (Sprint 006 blueprint `holdAndSay`): holds the mic
 * button, injects `text` as a recognition result via `window.__chloeVoice.transcribe`, then
 * releases, exactly like a founder speaking and letting go.
 */
export async function holdAndSay(page: Page, text: string) {
  const mic = page.getByTestId("mic-button");
  await mic.hover();
  await page.mouse.down();
  await page.waitForFunction(() => window.__chloeVoice !== undefined);
  await page.evaluate((spoken) => window.__chloeVoice!.transcribe(spoken), text);
  await page.mouse.up();
}

/** Every line the fake voice provider has spoken so far, in order (Sprint 006 blueprint `spoken`). */
export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__chloeVoice?.spoken() ?? []);
}

/** Load a seed scenario chip, confirm it on the review step, and wait for the route screen. */
export async function routeScenario(page: Page, label: string) {
  await page.goto("/route");
  await page.getByRole("button", { name: `Load scenario: ${label}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Confirm your brief" })).toBeVisible();
  await page.getByRole("button", { name: "Find my route" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your route through BASIX" })).toBeVisible();
}

export async function builderNames(page: Page): Promise<string[]> {
  return page.getByTestId("builder-card").getByRole("heading", { level: 3 }).allTextContents();
}

export async function builderIds(page: Page): Promise<string[]> {
  return page.getByTestId("builder-card").getByTestId("builder-id").allTextContents();
}
