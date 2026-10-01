/**
 * The device layer's one contract (Sprint 006 blueprint §Interfaces). Nothing above this line
 * knows whether speech comes from the browser, the engine's OpenRouter proxy or a test double:
 * `webSpeechProvider.ts`, `openRouterProvider.ts` (D-53) and `fakeVoiceProvider.ts` are the three
 * implementations.
 */

export type VoiceErrorCode = "no-speech" | "not-allowed" | "network" | "audio-capture" | "aborted" | "unknown";

export type VoiceError = { code: VoiceErrorCode; message?: string };

export type ListenHandlers = {
  /** A not-yet-final recognition result; never sent anywhere, only shown. */
  onInterim(text: string): void;
  /** One finalised recognition result; accumulated into the transcript `listen()` resolves. */
  onFinal(text: string): void;
  onError(error: VoiceError): void;
  /**
   * Fires once recognition has fully stopped, after any pending final results. A provider ends a
   * turn on its own when the founder stops talking (D-55): Web Speech's own endpointing, the
   * OpenRouter provider's VAD; `stopListening` forces the same end early.
   */
  onEnd(): void;
  /** Optional live mic level (RMS, 0..1) while listening, for the voice-mode orb. */
  onLevel?(level: number): void;
};

export interface VoiceProvider {
  kind: "web" | "openrouter" | "fake";
  /** True only when the provider has every browser API it needs: `SpeechRecognition`,
   * `speechSynthesis` and `SpeechSynthesisUtterance` for web; `getUserMedia`, `MediaRecorder`
   * and `Audio` for openrouter. */
  supported: boolean;
  /** Resolves once speech has ended, naturally or via `cancelSpeech`. */
  speak(text: string): Promise<void>;
  cancelSpeech(): void;
  startListening(handlers: ListenHandlers): void;
  /** Graceful release: flush any pending final result, then call `onEnd`. */
  stopListening(): void;
  /** Discard: recognition stops without flushing a final result. */
  abortListening(): void;
  /**
   * Optional voice barge-in (D-55, openrouter only): watch the mic while Chloe speaks and call
   * `onBargeIn` once, when the founder talks over her. Returns the function that stops watching.
   * Web Speech has none: it cannot be echo-cancelled reliably, so it relies on the tap.
   */
  monitorBargeIn?(onBargeIn: () => void): () => void;
}
