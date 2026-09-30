/**
 * Which `VoiceProvider` the app gets, decided once from `VITE_VOICE_PROVIDER` (D-38): `web`
 * (default) is the real browser provider; `fake` is the test double both RTL and Playwright
 * inject; `off` and the offline demo (`VITE_OFFLINE_DEMO=1`) mean no voice UI at all.
 */
import { OFFLINE_DEMO } from "../api/source";
import { createFakeVoiceProvider, installWindowHook } from "./fakeVoiceProvider";
import type { VoiceProvider } from "./provider";
import { createWebSpeechProvider, type WebSpeechProviderOptions } from "./webSpeechProvider";

export type VoiceProviderSetting = "web" | "fake" | "off";

function parseSetting(raw: string | undefined): VoiceProviderSetting {
  return raw === "fake" || raw === "off" ? raw : "web";
}

export const VOICE_PROVIDER: VoiceProviderSetting = parseSetting(import.meta.env.VITE_VOICE_PROVIDER);

export function selectProvider(
  setting: VoiceProviderSetting = VOICE_PROVIDER,
  offlineDemo: boolean = OFFLINE_DEMO,
  win: Window = window,
  /** Web provider only: the fake records display text untouched (ruling R10). */
  webOptions: WebSpeechProviderOptions = {},
): VoiceProvider | null {
  if (offlineDemo || setting === "off") return null;
  if (setting === "fake") {
    // Playwright drives the mic and speech through window.__chloeVoice (e2e/helpers.ts): a
    // VITE_VOICE_PROVIDER=fake build must expose it, not just return the provider (Missing #5).
    const provider = createFakeVoiceProvider();
    installWindowHook(provider, win);
    return provider;
  }
  return createWebSpeechProvider(win, webOptions);
}

/**
 * The one call site App.tsx makes when no test double is injected. App passes Chloe's
 * `spokenForm` as the web provider's `transform`, so display text becomes spoken text only at
 * the real speech boundary (#97, ruling R10).
 */
export function createVoiceProvider(webOptions: WebSpeechProviderOptions = {}): VoiceProvider | null {
  return selectProvider(VOICE_PROVIDER, OFFLINE_DEMO, window, webOptions);
}
