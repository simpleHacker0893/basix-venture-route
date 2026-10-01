/**
 * The voice session's published shape (mirrors `state/routingContext.ts`). `VoiceSession.tsx`
 * is the only file that constructs a value; every consumer (Sprint 006's `chloe/*`, not built by
 * this ticket) reads it through `useVoice()`.
 */
import { createContext } from "react";

import type { VoiceError, VoiceErrorCode, VoiceProvider } from "./provider";

/** How one listening turn ended: what was heard, and the recogniser's error, if any. */
export type ListenResult = { transcript: string; error: VoiceErrorCode | null };

export type VoiceStatus = "idle" | "listening" | "speaking";

export type VoiceSessionValue = {
  provider: VoiceProvider | null;
  /** False with no provider, or a web provider whose browser lacks the speech APIs. */
  supported: boolean;
  enabled: boolean;
  /** True once the session greeting has been spoken; stays true for the rest of the session. */
  greeted: boolean;
  /** True once the client has announced the keyless (`NullAdapter`) engine; sticky per session. */
  assistantOffline: boolean;
  status: VoiceStatus;
  /** The in-progress recognition result while `status === "listening"`. */
  interim: string;
  /** The utterance currently being spoken, or null while `status !== "speaking"`. */
  nowSpeaking: string | null;
  lastError: VoiceError | null;
  enable(): void;
  disable(): void;
  say(text: string): Promise<void>;
  stopSpeaking(): void;
  /** True while any line is playing or queued; synchronous, unlike `status`. */
  isSpeaking(): boolean;
  /** Starts one listening turn; resolves once the provider's `onEnd` fires (D-55). */
  listen(): Promise<ListenResult>;
  /** Discard the current recognition; a pending `listen()` resolves with "". */
  abortMic(): void;
  /** Live mic level while listening (RMS, 0..1), outside React state. Returns the unsubscribe. */
  subscribeLevel(listener: (level: number) => void): () => void;
  markGreeted(): void;
  markAssistantOffline(): void;
};

export const VoiceContext = createContext<VoiceSessionValue | null>(null);
