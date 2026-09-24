/**
 * The voice session's published shape (mirrors `state/routingContext.ts`). `VoiceSession.tsx`
 * is the only file that constructs a value; every consumer (Sprint 006's `chloe/*`, not built by
 * this ticket) reads it through `useVoice()`.
 */
import { createContext } from "react";

import type { VoiceError, VoiceProvider } from "./provider";

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
  pressMic(): void;
  /** Resolves with the accumulated final transcript once the provider's `onEnd` fires. */
  releaseMic(): Promise<string>;
  /** Discard the current recognition; a pending `releaseMic()` resolves with "". */
  abortMic(): void;
  markGreeted(): void;
  markAssistantOffline(): void;
};

export const VoiceContext = createContext<VoiceSessionValue | null>(null);
