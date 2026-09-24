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
      return { ...state, status: "idle", nowSpeaking: null };
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
  const supported = voice?.supported ?? false;

  const enable = useCallback(() => {
    if (!supported) return;
    dispatch({ type: "enabled", value: true });
  }, [supported]);

  const disable = useCallback(() => {
    voice?.cancelSpeech();
    voice?.abortListening();
    dispatch({ type: "enabled", value: false });
  }, [voice]);

  const say = useCallback(
    async (text: string) => {
      if (!voice) return;
      dispatch({ type: "speaking-started", text });
      await voice.speak(text);
      dispatch({ type: "speaking-ended" });
    },
    [voice],
  );

  const stopSpeaking = useCallback(() => {
    voice?.cancelSpeech();
  }, [voice]);

  const pressMic = useCallback(() => {
    if (!voice || !supported) return;
    finalText.current = "";
    dispatch({ type: "listening-started" });
    const handlers: ListenHandlers = {
      onInterim: (text) => dispatch({ type: "interim", text }),
      onFinal: (text) => {
        finalText.current = finalText.current ? `${finalText.current} ${text}` : text;
      },
      onError: (error) => dispatch({ type: "error", error }),
      onEnd: () => {
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
      if (!voice) {
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
      markGreeted,
      markAssistantOffline,
    }),
    [voice, supported, state, enable, disable, say, stopSpeaking, pressMic, releaseMic, markGreeted, markAssistantOffline],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceSessionValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice must be used inside VoiceSessionProvider");
  return value;
}
