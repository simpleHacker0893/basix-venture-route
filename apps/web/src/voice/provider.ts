/**
 * The device layer's one contract (Sprint 006 blueprint §Interfaces). Nothing above this line
 * knows whether speech comes from the browser or a test double; `webSpeechProvider.ts` and
 * `fakeVoiceProvider.ts` are the only two implementations.
 */

export type VoiceErrorCode = "no-speech" | "not-allowed" | "network" | "audio-capture" | "aborted" | "unknown";

export type VoiceError = { code: VoiceErrorCode; message?: string };

export type ListenHandlers = {
  /** A not-yet-final recognition result; never sent anywhere, only shown. */
  onInterim(text: string): void;
  /** One finalised recognition result; accumulated into the transcript `releaseMic` resolves. */
  onFinal(text: string): void;
  onError(error: VoiceError): void;
  /** Fires once recognition has fully stopped, after any pending final results. */
  onEnd(): void;
};

export interface VoiceProvider {
  kind: "web" | "fake";
  /** False whenever the browser lacks any of `SpeechRecognition`, `speechSynthesis` or
   * `SpeechSynthesisUtterance` — true only when the web provider has every API it needs. */
  supported: boolean;
  /** Resolves once speech has ended, naturally or via `cancelSpeech`. */
  speak(text: string): Promise<void>;
  cancelSpeech(): void;
  startListening(handlers: ListenHandlers): void;
  /** Graceful release: flush any pending final result, then call `onEnd`. */
  stopListening(): void;
  /** Discard: recognition stops without flushing a final result. */
  abortListening(): void;
}
