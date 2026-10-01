/**
 * Which `VoiceProvider` the app gets, decided once from `VITE_VOICE_PROVIDER` (D-38, D-53):
 * `web` (default) is the real browser provider; `openrouter` records with `MediaRecorder` and
 * goes through the engine's `/api/voice/*` proxy; `fake` is the test double both RTL and
 * Playwright inject; `off` and the offline demo (`VITE_OFFLINE_DEMO=1`) mean no voice UI at all.
 */
import { API_URL, OFFLINE_DEMO } from "../api/source";
import { createFakeVoiceProvider, installWindowHook } from "./fakeVoiceProvider";
import { createOpenRouterProvider } from "./openRouterProvider";
import type { VoiceProvider } from "./provider";
import { createWebSpeechProvider, type WebSpeechProviderOptions } from "./webSpeechProvider";

export type VoiceProviderSetting = "web" | "openrouter" | "fake" | "off";

/** What App passes to a real provider: today only Chloe's `spokenForm` as `transform`. */
export type VoiceProviderOptions = WebSpeechProviderOptions;

function parseSetting(raw: string | undefined): VoiceProviderSetting {
  return raw === "openrouter" || raw === "fake" || raw === "off" ? raw : "web";
}

export const VOICE_PROVIDER: VoiceProviderSetting = parseSetting(import.meta.env.VITE_VOICE_PROVIDER);

export function selectProvider(
  setting: VoiceProviderSetting = VOICE_PROVIDER,
  offlineDemo: boolean = OFFLINE_DEMO,
  win: Window = window,
  /** Real providers only (web and openrouter): the fake records display text untouched (R10). */
  webOptions: VoiceProviderOptions = {},
): VoiceProvider | null {
  if (offlineDemo || setting === "off") return null;
  if (setting === "fake") {
    // Playwright drives the mic and speech through window.__chloeVoice (e2e/helpers.ts): a
    // VITE_VOICE_PROVIDER=fake build must expose it, not just return the provider (Missing #5).
    const provider = createFakeVoiceProvider();
    installWindowHook(provider, win);
    return provider;
  }
  if (setting === "openrouter") {
    // Global fetch, looked up per call so tests can pass a bare window stub.
    return createOpenRouterProvider(win, {
      baseUrl: API_URL,
      fetchLike: (input, init) => fetch(input, init),
      transform: webOptions.transform,
    });
  }
  return createWebSpeechProvider(win, webOptions);
}

/**
 * The one call site App.tsx makes when no test double is injected. App passes Chloe's
 * `spokenForm` as the real provider's `transform` (web or openrouter), so display text becomes
 * spoken text only at the real speech boundary (#97, ruling R10).
 */
export function createVoiceProvider(webOptions: VoiceProviderOptions = {}): VoiceProvider | null {
  return selectProvider(VOICE_PROVIDER, OFFLINE_DEMO, window, webOptions);
}
