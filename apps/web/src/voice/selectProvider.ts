/**
 * Which `VoiceProvider` the app gets, decided once from `VITE_VOICE_PROVIDER` (D-38): `web`
 * (default) is the real browser provider; `fake` is the test double both RTL and Playwright
 * inject; `off` and the offline demo (`VITE_OFFLINE_DEMO=1`) mean no voice UI at all.
 */
import { OFFLINE_DEMO } from "../api/source";
import { createFakeVoiceProvider, installWindowHook } from "./fakeVoiceProvider";
import type { VoiceProvider } from "./provider";
import { createWebSpeechProvider } from "./webSpeechProvider";

export type VoiceProviderSetting = "web" | "fake" | "off";

function parseSetting(raw: string | undefined): VoiceProviderSetting {
  return raw === "fake" || raw === "off" ? raw : "web";
}

export const VOICE_PROVIDER: VoiceProviderSetting = parseSetting(import.meta.env.VITE_VOICE_PROVIDER);

export function selectProvider(
  setting: VoiceProviderSetting = VOICE_PROVIDER,
  offlineDemo: boolean = OFFLINE_DEMO,
  win: Window = window,
): VoiceProvider | null {
  if (offlineDemo || setting === "off") return null;
  if (setting === "fake") {
    // Playwright drives the mic and speech through window.__chloeVoice (e2e/helpers.ts): a
    // VITE_VOICE_PROVIDER=fake build must expose it, not just return the provider (Missing #5).
    const provider = createFakeVoiceProvider();
    installWindowHook(provider, win);
    return provider;
  }
  return createWebSpeechProvider(win);
}

/** The one call site App.tsx makes when no test double is injected. */
export function createVoiceProvider(): VoiceProvider | null {
  return selectProvider();
}
