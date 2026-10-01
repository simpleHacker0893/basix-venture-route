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
  finishUtterance(text: string): void;
  isListening(): boolean;
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
 * Voice mode through the fake provider (D-55, replaces Sprint 006's `holdAndSay`): taps "Start
 * voice mode" once unless the voice panel is already up, waits until Chloe has finished and the
 * mic has opened by itself, then lets the fake hear `text` and end the turn on its own, exactly
 * like a founder speaking and pausing.
 */
export async function tapAndSay(page: Page, text: string) {
  if ((await page.getByTestId("voice-panel").count()) === 0) {
    await page.getByRole("button", { name: "Start voice mode" }).click();
  }
  await page.waitForFunction(() => window.__chloeVoice?.isListening() === true);
  await page.evaluate((spoken) => window.__chloeVoice!.finishUtterance(spoken), text);
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
