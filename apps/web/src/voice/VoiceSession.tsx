/**
 * `VoiceSessionProvider` + `voiceReducer`; `useVoice()` reads the published `VoiceSessionValue`
 * (Sprint 006 blueprint §Interfaces). This is the session layer only: it turns one `VoiceProvider`
 * into `enabled` / `status` / `interim` / `lastError` state and the `enable` / `pressMic` /
 * `releaseMic` / `say` verbs. Chloe's conductor (`chloe/useChloe.ts`, a later ticket) decides
 * *when* to call them; this file has no opinion about the routing store or the conversation.
 */
import { useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from "react";

import type { ListenHandlers, VoiceError, VoiceProvider } from "./provider";
import { VoiceContext, type VoiceSessionValue, type VoiceStatus } from "./voiceContext";

type VoiceState = {
  enabled: boolean;
  greeted: boolean;
  assistantOffline: boolean;
  status: VoiceStatus;
  interim: string;
  nowSpeaking: string | null;
  lastError: VoiceError | null;
};

const initialVoiceState: VoiceState = {
  enabled: false,
  greeted: false,
  assistantOffline: false,
  status: "idle",
  interim: "",
  nowSpeaking: null,
  lastError: null,
};

export type VoiceAction =
  | { type: "enabled"; value: boolean }
  | { type: "greeted" }
  | { type: "assistant-offline" }
  | { type: "listening-started" }
  | { type: "interim"; text: string }
  | { type: "listening-ended" }
  | { type: "speaking-started"; text: string }
  | { type: "speaking-ended" }
  | { type: "error"; error: VoiceError };

export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "enabled":
      if (action.value) return { ...state, enabled: true };
      // Turning voice off clears everything transient; the greeting and the keyless notice stay
      // sticky for the rest of the session (blueprint §Conductor: "once per session").
      return { ...initialVoiceState, greeted: state.greeted, assistantOffline: state.assistantOffline };
    case "greeted":
      return { ...state, greeted: true };
    case "assistant-offline":
      return { ...state, assistantOffline: true };
    case "listening-started":
      return { ...state, status: "listening", interim: "", lastError: null };
    case "interim":
      return { ...state, interim: action.text };
    case "listening-ended":
      return { ...state, status: "idle", interim: "" };
    case "speaking-started":
      return { ...state, status: "speaking", nowSpeaking: action.text };
    case "speaking-ended":
      // Stopping speech while the mic is held must not end the listening state.
      return { ...state, status: state.status === "speaking" ? "idle" : state.status, nowSpeaking: null };
    case "error":
      return { ...state, lastError: action.error, status: "idle" };
    default:
      return state;
  }
}

type Props = {
  /** `null` when no provider is available (`off`, offline demo, or an unsupported browser). */
  voice: VoiceProvider | null;
  children: ReactNode;
};

export function VoiceSessionProvider({ voice, children }: Props) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const endResolvers = useRef<Array<(text: string) => void>>([]);
  const finalText = useRef("");
  const listeningRef = useRef(false);
  const supported = voice?.supported ?? false;

  const enable = useCallback(() => {
    if (!supported) return;
    dispatch({ type: "enabled", value: true });
  }, [supported]);

  /**
   * The utterance queue: `say` calls play one after another (the web provider's `speak` cancels
   * whatever is in flight, so back-to-back lines must wait their turn). `stopSpeaking` bumps the
   * generation, which drops every queued line and cancels the one playing ("Stop Chloe").
   */
  const generation = useRef(0);
  const queued = useRef(0);
  const queueTail = useRef<Promise<void>>(Promise.resolve());

  const stopSpeaking = useCallback(() => {
    generation.current += 1;
    voice?.cancelSpeech();
    dispatch({ type: "speaking-ended" });
  }, [voice]);

  /**
   * Discard the current recognition (no final flush, no `onEnd` from the provider): any
   * `releaseMic()` still waiting resolves with "" so its caller never hangs (#97 carry-over).
   */
  const abortMic = useCallback(() => {
    voice?.abortListening();
    const wasListening = listeningRef.current;
    listeningRef.current = false;
    const resolvers = endResolvers.current;
    endResolvers.current = [];
    resolvers.forEach((resolve) => resolve(""));
    if (wasListening) dispatch({ type: "listening-ended" });
  }, [voice]);

  const disable = useCallback(() => {
    stopSpeaking();
    abortMic();
    dispatch({ type: "enabled", value: false });
  }, [stopSpeaking, abortMic]);

  const say = useCallback(
    (text: string): Promise<void> => {
      if (!voice) return Promise.resolve();
      const turn = generation.current;
      const play = async () => {
        if (turn !== generation.current) return;
        dispatch({ type: "speaking-started", text });
        await voice.speak(text);
        if (turn === generation.current && queued.current === 1) dispatch({ type: "speaking-ended" });
      };
      // An idle queue starts at once, synchronously, so a line said inside a click handler is
      // spoken inside that user gesture (the greeting, requirements.md §Business rules).
      const run = queued.current === 0 ? play() : queueTail.current.then(play);
      queued.current += 1;
      const done = run.finally(() => {
        queued.current -= 1;
      });
      queueTail.current = done;
      return done;
    },
    [voice],
  );

  const pressMic = useCallback(() => {
    if (!voice || !supported) return;
    finalText.current = "";
    listeningRef.current = true;
    dispatch({ type: "listening-started" });
    const handlers: ListenHandlers = {
      onInterim: (text) => dispatch({ type: "interim", text }),
      onFinal: (text) => {
        finalText.current = finalText.current ? `${finalText.current} ${text}` : text;
      },
      onError: (error) => dispatch({ type: "error", error }),
      onEnd: () => {
        listeningRef.current = false;
        dispatch({ type: "listening-ended" });
        const resolvers = endResolvers.current;
        endResolvers.current = [];
        const text = finalText.current;
        resolvers.forEach((resolve) => resolve(text));
      },
    };
    voice.startListening(handlers);
  }, [voice, supported]);

  const releaseMic = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      // Nothing is listening (never pressed, already ended, or disabled mid-press): resolve
      // immediately instead of waiting on an `onEnd` that will never come.
      if (!voice || !listeningRef.current) {
        resolve("");
        return;
      }
      endResolvers.current.push(resolve);
      voice.stopListening();
    });
  }, [voice]);

  const markGreeted = useCallback(() => dispatch({ type: "greeted" }), []);
  const markAssistantOffline = useCallback(() => dispatch({ type: "assistant-offline" }), []);

  const value = useMemo<VoiceSessionValue>(
    () => ({
      provider: voice,
      supported,
      enabled: state.enabled,
      greeted: state.greeted,
      assistantOffline: state.assistantOffline,
      status: state.status,
      interim: state.interim,
      nowSpeaking: state.nowSpeaking,
      lastError: state.lastError,
      enable,
      disable,
      say,
      stopSpeaking,
      pressMic,
      releaseMic,
      abortMic,
      markGreeted,
      markAssistantOffline,
    }),
    [voice, supported, state, enable, disable, say, stopSpeaking, pressMic, releaseMic, abortMic, markGreeted, markAssistantOffline],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceSessionValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice must be used inside VoiceSessionProvider");
  return value;
}
