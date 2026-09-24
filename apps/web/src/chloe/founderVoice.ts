/**
 * The founder-wide voice switch (#102, spec #86 stories 69-72). There is ONE voice state, the
 * `VoiceSession`; this context only carries the switch handler the top nav calls and lets /route
 * hand it Chloe's own `toggleVoice` (so the greeting lands in the chat thread there). Controller
 * ruling R6: the top-nav and intake-header switches render the same session state.
 */
import { createContext, useContext } from "react";

export type FounderVoiceValue = {
  /** The switch handler: the greeting is spoken inside this click, once per session. */
  toggle(): void;
  /** /route's conductor registers its `toggleVoice` while mounted; returns the unregister. */
  registerRouteToggle(toggle: () => void): () => void;
};

export const FounderVoiceContext = createContext<FounderVoiceValue | null>(null);

export function useFounderVoice(): FounderVoiceValue | null {
  return useContext(FounderVoiceContext);
}

/** Session-only memory of the switch (sessionStorage; the tab forgets it on close). */
export const VOICE_STORAGE_KEY = "venture-route:voice";

export type StoredVoice = { on: boolean; greeted: boolean };

export function readStoredVoice(storage: Storage | undefined = globalThis.sessionStorage): StoredVoice | null {
  try {
    const raw = storage?.getItem(VOICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredVoice> | null;
    return { on: parsed?.on === true, greeted: parsed?.greeted === true };
  } catch {
    return null;
  }
}

export function writeStoredVoice(value: StoredVoice, storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.setItem(VOICE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the switch still works for this page, it just is not remembered.
  }
}

/**
 * Browsers refuse speech before the page has had a user gesture. After a reload the switch is
 * restored from sessionStorage, but an arrival read-aloud must wait for a click ("Read aloud").
 * Where the API is missing (older browsers, jsdom) the SPA navigation click is assumed.
 */
export function pageHasUserGesture(nav: Navigator = globalThis.navigator): boolean {
  const activation = (nav as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : true;
}
