/**
 * `VoiceSessionProvider` + `voiceReducer`; `useVoice()` reads the published `VoiceSessionValue`
 * (Sprint 006 blueprint §Interfaces). This is the session layer only: it turns one `VoiceProvider`
 * into `enabled` / `status` / `interim` / `lastError` state and the `enable` / `listen` /
 * `finishListening` / `say` verbs. Chloe's conductor (`chloe/useChloe.ts`) and its voice mode
 * (`chloe/useVoiceMode.ts`, D-55) decide *when* to call them; this file has no opinion about the
 * routing store or the conversation.
 */
import { useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from "react";

import type { ListenHandlers, VoiceError, VoiceErrorCode, VoiceProvider } from "./provider";
import { VoiceContext, type ListenResult, type VoiceSessionValue, type VoiceStatus } from "./voiceContext";

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
      // Stopping speech while the mic is open must not end the listening state.
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

const NOTHING_HEARD: ListenResult = { transcript: "", error: null };

export function VoiceSessionProvider({ voice, children }: Props) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const endResolvers = useRef<Array<(result: ListenResult) => void>>([]);
  const finalText = useRef("");
  const turnError = useRef<VoiceErrorCode | null>(null);
  /** Bumped by every listen() and abort: a superseded turn's late callbacks are ignored. */
  const listenTurn = useRef(0);
  const listeningRef = useRef(false);
  const levelListeners = useRef(new Set<(level: number) => void>());
  const supported = voice?.supported ?? false;

  const resolveAll = useCallback((result: ListenResult) => {
    const resolvers = endResolvers.current;
    endResolvers.current = [];
    resolvers.forEach((resolve) => resolve(result));
  }, []);

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
  /** The generation of the newest queued line: lines from before a `stopSpeaking` never count. */
  const queuedGeneration = useRef(0);

  const stopSpeaking = useCallback(() => {
    generation.current += 1;
    voice?.cancelSpeech();
    dispatch({ type: "speaking-ended" });
  }, [voice]);

  /**
   * Discard the current recognition (no final flush, no `onEnd` from the provider): any
   * `listen()` still waiting resolves with "" so its caller never hangs (#97 carry-over).
   */
  const abortMic = useCallback(() => {
    voice?.abortListening();
    listenTurn.current += 1;
    const wasListening = listeningRef.current;
    listeningRef.current = false;
    resolveAll(NOTHING_HEARD);
    if (wasListening) dispatch({ type: "listening-ended" });
  }, [voice, resolveAll]);

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
      };
      // An idle queue starts at once, synchronously, so a line said inside a click handler is
      // spoken inside that user gesture (the greeting, requirements.md §Business rules).
      const run = queued.current === 0 ? play() : queueTail.current.then(play);
      queued.current += 1;
      queuedGeneration.current = turn;
      // The count drops before "speaking-ended" is dispatched, so `isSpeaking()` is already false
      // when that render runs (voice mode reopens the mic on it, D-55). A rejecting speak() must
      // not leave status stuck on "speaking": this runs whether it resolved or threw, and the
      // rejection still propagates.
      const done = run.finally(() => {
        queued.current -= 1;
        if (queued.current === 0) dispatch({ type: "speaking-ended" });
      });
      // A speak() that throws must not stall the queue: the next line waits on a settled tail.
      queueTail.current = done.catch(() => undefined);
      return done;
    },
    [voice],
  );

  // Lines dropped by `stopSpeaking` still drain through the queue for a few microtasks; they are
  // already silent, so they do not count.
  const isSpeaking = useCallback(() => queued.current > 0 && queuedGeneration.current === generation.current, []);

  /**
   * One listening turn (D-55). Resolves once the provider ends the turn, on its own endpointing
   * or after `finishListening()`, with the accumulated final transcript and the turn's error, if
   * any; resolves with "" when the turn is aborted or superseded.
   */
  const listen = useCallback((): Promise<ListenResult> => {
    if (!voice || !supported) return Promise.resolve(NOTHING_HEARD);
    // A turn still waiting on the previous recording (e.g. a transcribe round-trip) is discarded
    // by the provider when a new one starts, with no onEnd: resolve it with "" now so it neither
    // hangs nor later receives this turn's transcript (#127 fix round 1).
    resolveAll(NOTHING_HEARD);
    listenTurn.current += 1;
    const turn = listenTurn.current;
    const current = () => turn === listenTurn.current;
    finalText.current = "";
    turnError.current = null;
    listeningRef.current = true;
    dispatch({ type: "listening-started" });
    const result = new Promise<ListenResult>((resolve) => endResolvers.current.push(resolve));
    const handlers: ListenHandlers = {
      onInterim: (text) => {
        if (current()) dispatch({ type: "interim", text });
      },
      onFinal: (text) => {
        if (current()) finalText.current = finalText.current ? `${finalText.current} ${text}` : text;
      },
      onError: (error) => {
        if (!current()) return;
        turnError.current = error.code;
        dispatch({ type: "error", error });
      },
      onEnd: () => {
        if (!current()) return;
        listeningRef.current = false;
        dispatch({ type: "listening-ended" });
        resolveAll({ transcript: finalText.current, error: turnError.current });
      },
      onLevel: (level) => {
        if (current()) levelListeners.current.forEach((listener) => listener(level));
      },
    };
    voice.startListening(handlers);
    return result;
  }, [voice, supported, resolveAll]);

  const finishListening = useCallback(() => {
    if (voice && listeningRef.current) voice.stopListening();
  }, [voice]);

  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    levelListeners.current.add(listener);
    return () => {
      levelListeners.current.delete(listener);
    };
  }, []);

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
      isSpeaking,
      listen,
      finishListening,
      abortMic,
      subscribeLevel,
      markGreeted,
      markAssistantOffline,
    }),
    [
      voice,
      supported,
      state,
      enable,
      disable,
      say,
      stopSpeaking,
      isSpeaking,
      listen,
      finishListening,
      abortMic,
      subscribeLevel,
      markGreeted,
      markAssistantOffline,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceSessionValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice must be used inside VoiceSessionProvider");
  return value;
}
