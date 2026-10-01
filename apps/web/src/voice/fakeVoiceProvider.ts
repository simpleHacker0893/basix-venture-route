/**
 * The test double for both RTL (`test/fakeEngine.tsx`) and Playwright (`e2e/chloe.spec.ts`)
 * seams (Sprint 006 blueprint §Interfaces). It never touches a browser speech API: `speak`
 * records into `spoken`, and a caller injects recognition results through `transcribe` / `fail`
 * instead of a real microphone. `finishUtterance` is the hands-free turn (D-55): it plays the part
 * of a real provider's own endpointing, finalising what was "said" and ending the turn.
 */
import type { ListenHandlers, VoiceError, VoiceErrorCode, VoiceProvider } from "./provider";

export type FakeVoiceProviderOptions = {
  /** When true, `speak` never resolves on its own; the test calls `finishSpeaking()`. */
  holdUtterances?: boolean;
};

export type FakeVoiceProvider = VoiceProvider & {
  kind: "fake";
  /** Every utterance passed to `speak`, in order. */
  spoken: string[];
  /** While listening, emits `onInterim(text)` then `onFinal(text)`; a no-op otherwise. */
  transcribe(text: string): void;
  /** While listening, emits `onError({ code })`; a no-op otherwise. */
  fail(code: VoiceErrorCode): void;
  /**
   * While listening, ends the turn the way a real provider's endpointing does: `onInterim` and
   * `onFinal` with `text` (skipped for "", which is a silent turn), then `onEnd`. A no-op otherwise.
   */
  finishUtterance(text: string): void;
  /** True between `startListening` and the turn's end or abort. */
  isListening(): boolean;
  /** Resolves the utterance `speak` is holding under `holdUtterances`. */
  finishSpeaking(): void;
};

/** The shape `installWindowHook` publishes for Playwright (`window.__chloeVoice`). */
export type ChloeVoiceWindowHook = {
  spoken(): string[];
  transcribe(text: string): void;
  fail(code: VoiceErrorCode): void;
  finishUtterance(text: string): void;
  isListening(): boolean;
  finishSpeaking(): void;
};

export function createFakeVoiceProvider(options: FakeVoiceProviderOptions = {}): FakeVoiceProvider {
  const spoken: string[] = [];
  let listening = false;
  let handlers: ListenHandlers | null = null;
  let pendingSpeak: (() => void) | null = null;

  function speak(text: string): Promise<void> {
    spoken.push(text);
    if (options.holdUtterances) {
      return new Promise((resolve) => {
        pendingSpeak = resolve;
      });
    }
    return Promise.resolve();
  }

  function resolvePending(): void {
    if (!pendingSpeak) return;
    const resolve = pendingSpeak;
    pendingSpeak = null;
    resolve();
  }

  function cancelSpeech(): void {
    resolvePending();
  }

  function finishSpeaking(): void {
    resolvePending();
  }

  function startListening(h: ListenHandlers): void {
    listening = true;
    handlers = h;
  }

  function stopListening(): void {
    const active = handlers;
    listening = false;
    handlers = null;
    active?.onEnd();
  }

  function abortListening(): void {
    listening = false;
    handlers = null;
  }

  function transcribe(text: string): void {
    if (!listening || !handlers) return;
    handlers.onInterim(text);
    handlers.onFinal(text);
  }

  function fail(code: VoiceErrorCode): void {
    if (!listening || !handlers) return;
    const error: VoiceError = { code };
    handlers.onError(error);
  }

  function finishUtterance(text: string): void {
    if (!listening || !handlers) return;
    const active = handlers;
    if (text) {
      active.onInterim(text);
      active.onFinal(text);
    }
    listening = false;
    handlers = null;
    active.onEnd();
  }

  return {
    kind: "fake",
    supported: true,
    spoken,
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    abortListening,
    transcribe,
    fail,
    finishUtterance,
    isListening: () => listening,
    finishSpeaking,
  };
}

/** Fake only: Playwright drives the mic through `window.__chloeVoice` (Sprint 006 e2e/helpers.ts). */
export function installWindowHook(provider: FakeVoiceProvider, win: Window = window): void {
  const hook: ChloeVoiceWindowHook = {
    spoken: () => [...provider.spoken],
    transcribe: (text) => provider.transcribe(text),
    fail: (code) => provider.fail(code),
    finishUtterance: (text) => provider.finishUtterance(text),
    isListening: () => provider.isListening(),
    finishSpeaking: () => provider.finishSpeaking(),
  };
  (win as Window & { __chloeVoice?: ChloeVoiceWindowHook }).__chloeVoice = hook;
}
