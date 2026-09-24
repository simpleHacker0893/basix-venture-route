/**
 * Chloe's conductor (Sprint 006 blueprint §Conductor): one reaction effect over the routing
 * store plus `submitTranscript` for the mic. Chloe restates only what the engine returned
 * (script.ts templates over `ChatResponse` / `VentureRoute`) and never decides anything: every
 * request goes through the existing `sendTurn`, and the only post she makes on her own is the
 * read-back "yes", which is exactly what the "Find my route" button posts.
 *
 * Every line goes to the voice session as DISPLAY text and to the thread through `noteChloe`;
 * `spokenForm` is applied by the web provider at the speech boundary (ruling R10).
 */
import type { ChatResponse } from "@venture-route/contracts";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";

import { missingFields } from "../lib/brief";
import { useRouting } from "../state/routingContext";
import type { View } from "../state/routingReducer";
import type { VoiceErrorCode } from "../voice/provider";
import { useVoice } from "../voice/VoiceSession";
import type { VoiceSessionValue } from "../voice/voiceContext";
import { matchConfirm } from "./confirm";
import { isKeyless } from "./engineHints";
import {
  CONFIRM_NO_REPLY,
  CONFIRM_PROMPT,
  CONFIRM_YES_REPLY,
  GREETING,
  MIC_ERRORS,
  OFFLINE_ASSISTANT,
  questionFor,
  readBack,
  speakRoute,
  UNREACHABLE,
  validationSpoken,
} from "./script";

export type SubmitOutcome = "sent" | "held" | "dictation" | "empty";

export type ChloeValue = VoiceSessionValue & {
  /** True between the read-back's "Shall I find your route?" and a yes / no / validation-error. */
  awaitingConfirmation: boolean;
  /** The mic error line to show, or null. */
  micError: VoiceErrorCode | null;
  /** The "Voice: Chloe" switch handler: the greeting is spoken here, inside the user gesture. */
  toggleVoice(): void;
  /** Push-to-talk press: cancels any speech in progress, then starts listening. */
  pressMic(): void;
  /** Routes a released transcript: confirm, dictation (keyless), or a founder turn. */
  submitTranscript(text: string): Promise<SubmitOutcome>;
};

export const ChloeContext = createContext<ChloeValue | null>(null);

/** Null outside `ChloeProvider` (the voice UI then renders nothing). */
export function useChloe(): ChloeValue | null {
  return useContext(ChloeContext);
}

type Seen = { view: View; formMode: boolean; busy: boolean; lastResponse: ChatResponse | null };

export function useChloeConductor({ formMode }: { formMode: boolean }): ChloeValue {
  const voice = useVoice();
  const { state, sendTurn, noteChloe } = useRouting();
  const { view, busy, lastResponse, currentBrief, unreachable } = state;
  const { enabled, greeted, assistantOffline, lastError, say, stopSpeaking, abortMic, enable, disable, markGreeted, markAssistantOffline } =
    voice;

  // A reducer, not useState: the read-back effect opens the confirmation and a validation-error
  // closes it, both as reactions to engine responses (blueprint §Conductor).
  const [awaitingConfirmation, setAwaitingConfirmation] = useReducer((_: boolean, next: boolean) => next, false);
  const [emptyRelease, setEmptyRelease] = useState(false);

  const seen = useRef<Seen>({ view, formMode, busy, lastResponse });
  const spokenForResponse = useRef<ChatResponse | null>(null);
  const confirmedBriefKey = useRef<string | null>(null);
  const spokenUnreachable = useRef<string | null>(null);
  const spokenError = useRef<unknown>(null);
  /** Set while Chloe's own "yes" post starts, so its request-started does not cut her reply. */
  const chloePosting = useRef(false);

  const utter = useCallback(
    (text: string) => {
      noteChloe(text);
      void say(text);
    },
    [noteChloe, say],
  );

  useEffect(() => {
    const before = seen.current;
    seen.current = { view, formMode, busy, lastResponse };
    if (!enabled) return;

    // Cancellation first: a user-driven view change or a new request silences Chloe. The view
    // change that arrives with a response (the route) does not: that is when she speaks it.
    const responseArrived = lastResponse !== null && lastResponse !== before.lastResponse;
    const userViewChange = (view !== before.view && !responseArrived) || formMode !== before.formMode;
    const requestStarted = busy && !before.busy;
    if (requestStarted && chloePosting.current) {
      chloePosting.current = false;
    } else if (userViewChange || requestStarted) {
      stopSpeaking();
      abortMic();
    }

    if (unreachable === null) {
      spokenUnreachable.current = null;
    } else if (unreachable !== spokenUnreachable.current) {
      spokenUnreachable.current = unreachable;
      utter(UNREACHABLE);
    }

    if (lastResponse !== null && lastResponse !== spokenForResponse.current) {
      spokenForResponse.current = lastResponse;
      if (lastResponse.type === "clarification") {
        if (isKeyless(lastResponse)) {
          if (!assistantOffline) {
            markAssistantOffline();
            utter(OFFLINE_ASSISTANT);
          }
        } else if (!assistantOffline && lastResponse.missingFields.length > 0) {
          // One question per turn: the engine's first missing field (PRD §5.3 order).
          utter(questionFor(lastResponse.missingFields[0]!));
        }
      } else if (lastResponse.type === "route") {
        speakRoute(lastResponse.route).forEach(utter);
      } else {
        setAwaitingConfirmation(false);
        utter(validationSpoken(lastResponse.message));
      }
    }

    if (
      view === "intake" &&
      !formMode &&
      currentBrief !== null &&
      missingFields(currentBrief).length === 0 &&
      lastResponse?.type !== "route"
    ) {
      const key = JSON.stringify(currentBrief);
      if (key !== confirmedBriefKey.current) {
        confirmedBriefKey.current = key;
        utter(readBack(currentBrief));
        utter(CONFIRM_PROMPT);
        setAwaitingConfirmation(true);
      }
    }
  }, [
    enabled,
    view,
    formMode,
    busy,
    lastResponse,
    currentBrief,
    unreachable,
    assistantOffline,
    stopSpeaking,
    abortMic,
    markAssistantOffline,
    utter,
  ]);

  // Recogniser failures are spoken once each. `no-speech` is spoken by the empty release below
  // instead, and `aborted` is Chloe's own doing (a view change or disabling voice).
  useEffect(() => {
    if (!enabled || lastError === null || lastError === spokenError.current) return;
    spokenError.current = lastError;
    if (lastError.code === "no-speech" || lastError.code === "aborted") return;
    utter(MIC_ERRORS[lastError.code]);
  }, [enabled, lastError, utter]);

  // Leaving /route unmounts ChloeProvider: silence her and drop the mic.
  useEffect(
    () => () => {
      stopSpeaking();
      abortMic();
    },
    [stopSpeaking, abortMic],
  );

  const toggleVoice = useCallback(() => {
    if (enabled) {
      disable();
      return;
    }
    enable();
    if (!greeted) {
      markGreeted();
      utter(GREETING);
    }
  }, [enabled, greeted, enable, disable, markGreeted, utter]);

  const pressMic = useCallback(() => {
    stopSpeaking();
    setEmptyRelease(false);
    voice.pressMic();
  }, [stopSpeaking, voice]);

  const submitTranscript = useCallback(
    async (text: string): Promise<SubmitOutcome> => {
      if (busy) return "held";
      const transcript = text.trim();
      if (!transcript) {
        setEmptyRelease(true);
        utter(MIC_ERRORS["no-speech"]);
        return "empty";
      }
      if (awaitingConfirmation) {
        const answer = matchConfirm(transcript);
        if (answer === "yes") {
          setAwaitingConfirmation(false);
          utter(CONFIRM_YES_REPLY);
          chloePosting.current = true;
          // Exactly the "Find my route" post: no founder turn, the current brief as it stands.
          await sendTurn({ userMessage: "", currentBrief });
          return "sent";
        }
        if (answer === "no") {
          setAwaitingConfirmation(false);
          utter(CONFIRM_NO_REPLY);
          return "held";
        }
      }
      if (assistantOffline) return "dictation";
      await sendTurn({ userMessage: transcript, currentBrief: currentBrief ?? null });
      return "sent";
    },
    [busy, awaitingConfirmation, assistantOffline, currentBrief, sendTurn, utter],
  );

  const micError: VoiceErrorCode | null = emptyRelease
    ? "no-speech"
    : lastError !== null && lastError.code !== "aborted"
      ? lastError.code
      : null;

  return { ...voice, awaitingConfirmation, micError, toggleVoice, pressMic, submitTranscript };
}
