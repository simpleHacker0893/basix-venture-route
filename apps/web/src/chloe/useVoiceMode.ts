/**
 * Voice mode's side effects (#128, D-55) around the pure machine in `voiceMode.ts`. Called by
 * Chloe's conductor, after its own reaction effects, so by the time these effects run any line
 * the conductor has just said is already in the utterance queue (`isSpeaking()` is synchronous).
 *
 * - Half-duplex: a listening turn opens only when Chloe's queue is empty and no request is in
 *   flight; each finished utterance goes through the conductor's `submitTranscript`.
 * - Barge-in: tapping the orb interrupts on every provider; a provider with `monitorBargeIn`
 *   (openrouter) also lets the founder interrupt by voice.
 * - Idle: silent turns reopen locally; after `IDLE_MUTE_MS` with no speech the mic mutes itself
 *   and Chloe says `VOICE_IDLE_MUTED` once.
 * - Exits: End, Escape, voice disabled, the route on screen (after Chloe has read it), leaving
 *   the intake chat, a `not-allowed` / `audio-capture` error. Leaving /route unmounts it all.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { VoiceSessionValue } from "../voice/voiceContext";
import { VOICE_IDLE_MUTED } from "./script";
import { IDLE_MUTE_MS, VOICE_MODE_OFF, voiceModeReducer, type VoiceModePhase } from "./voiceMode";

export type SubmitOutcome = "sent" | "held" | "dictation" | "empty";

export type VoiceModeValue = {
  phase: VoiceModePhase;
  /** The "Start voice mode" tap: turns voice on if needed (greeting inside the gesture). */
  start(options?: { onDictation?(text: string): void }): void;
  /** End (✕) and Escape: Chloe stops, the mic closes, the intake row comes back. */
  end(): void;
  mute(): void;
  unmute(): void;
  /** The orb tap while Chloe speaks: she stops at once and the founder has the floor. */
  interrupt(): void;
};

type Options = {
  voice: VoiceSessionValue;
  busy: boolean;
  /** The intake chat is on screen (not the form, review or the route). */
  canListen: boolean;
  /** Turns voice on and speaks the greeting once per session, inside the calling gesture. */
  turnVoiceOn(): void;
  submitTranscript(text: string): Promise<SubmitOutcome>;
  utter(text: string): void;
};

/** Errors after which listening cannot work: Chloe speaks them once and voice mode ends. */
const FATAL: ReadonlySet<string> = new Set(["not-allowed", "audio-capture"]);

export function useVoiceMode({ voice, busy, canListen, turnVoiceOn, submitTranscript, utter }: Options): VoiceModeValue {
  const [state, dispatch] = useReducer(voiceModeReducer, VOICE_MODE_OFF);
  const { phase, turn } = state;
  const { enabled, lastError, isSpeaking, listen, abortMic, stopSpeaking, provider } = voice;

  // The listen promise settles later: read the conductor's latest submitTranscript (busy,
  // confirmation state) and the caller's dictation handler at that moment.
  const submitRef = useRef(submitTranscript);
  const dictationRef = useRef<((text: string) => void) | undefined>(undefined);
  const lastSpeechAt = useRef(0);
  useEffect(() => {
    submitRef.current = submitTranscript;
  });

  // Follow the world on every render; the reducer returns the same state when nothing changed,
  // so this settles at once. Chloe's queue draining re-renders through the session's status.
  useEffect(() => {
    dispatch({ type: "sync", chloeSpeaking: isSpeaking(), busy, canListen });
  });

  // Voice turned off (either switch) ends voice mode.
  useEffect(() => {
    if (!enabled) dispatch({ type: "end" });
  }, [enabled]);

  // A mic that cannot work ends voice mode as soon as the error lands, before the turn's own end:
  // the conductor speaks the error once, and that line must not reopen the mic after it.
  useEffect(() => {
    if (lastError !== null && FATAL.has(lastError.code)) dispatch({ type: "end" });
  }, [lastError]);

  // One listening turn per `turn`. Its cleanup closes the mic whenever the phase moves on.
  useEffect(() => {
    if (phase !== "listening") return;
    if (isSpeaking()) {
      dispatch({ type: "sync", chloeSpeaking: true, busy, canListen });
      return;
    }
    let live = true;
    void listen().then(async ({ transcript, error }) => {
      if (!live) return;
      if (error !== null && FATAL.has(error)) {
        // The conductor's error effect speaks it once; nothing to listen with any more.
        dispatch({ type: "end" });
        return;
      }
      const text = transcript.trim();
      if (!text) {
        dispatch({ type: "silence" });
        return;
      }
      lastSpeechAt.current = Date.now();
      dispatch({ type: "heard" });
      const outcome = await submitRef.current(text);
      if (outcome === "dictation") {
        // Keyless engine: the words go to the reply box for the founder to edit and send.
        dictationRef.current?.(text);
        dispatch({ type: "end" });
        return;
      }
      dispatch({ type: "submitted" });
    });
    return () => {
      live = false;
      abortMic();
    };
    // `turn` reopens the mic after a silent turn; busy/canListen are read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, listen, abortMic, isSpeaking]);

  const interrupt = useCallback(() => {
    stopSpeaking();
    lastSpeechAt.current = Date.now();
    dispatch({ type: "interrupt" });
  }, [stopSpeaking]);

  // Voice barge-in, where the provider can (openrouter): watch the mic while Chloe speaks.
  const interruptRef = useRef(interrupt);
  useEffect(() => {
    interruptRef.current = interrupt;
  });
  useEffect(() => {
    if (phase !== "speaking" || !canListen || !provider?.monitorBargeIn) return;
    return provider.monitorBargeIn(() => interruptRef.current());
  }, [phase, canListen, provider]);

  // Idle: the clock runs across silent turns and restarts only when the founder speaks.
  useEffect(() => {
    if (phase !== "listening") return;
    const wait = Math.max(0, IDLE_MUTE_MS - (Date.now() - lastSpeechAt.current));
    const timer = setTimeout(() => {
      dispatch({ type: "mute" });
      utter(VOICE_IDLE_MUTED);
    }, wait);
    return () => clearTimeout(timer);
  }, [phase, utter]);

  const end = useCallback(() => {
    dispatch({ type: "end" });
    stopSpeaking();
    abortMic();
  }, [stopSpeaking, abortMic]);

  // Escape ends voice mode wherever focus is.
  useEffect(() => {
    if (phase === "off") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, end]);

  const start = useCallback(
    (options: { onDictation?(text: string): void } = {}) => {
      if (!voice.supported) return;
      dictationRef.current = options.onDictation;
      turnVoiceOn();
      lastSpeechAt.current = Date.now();
      dispatch({ type: "enter", chloeSpeaking: isSpeaking() });
    },
    [voice.supported, turnVoiceOn, isSpeaking],
  );

  const mute = useCallback(() => dispatch({ type: "mute" }), []);
  const unmute = useCallback(() => {
    lastSpeechAt.current = Date.now();
    dispatch({ type: "unmute", chloeSpeaking: isSpeaking() });
  }, [isSpeaking]);

  return { phase, start, end, mute, unmute, interrupt };
}
