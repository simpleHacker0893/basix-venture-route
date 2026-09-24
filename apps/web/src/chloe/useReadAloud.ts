/**
 * Read-aloud for the founder screens (#102): the lines are templated by `script.ts` from one API
 * response and only spoken, never acted on. Spoken at most once per visit, when the response
 * first arrives with voice on (and the page has had a user gesture), then again on "Read aloud".
 * Leaving the screen cancels her speech. No mic, no transcript, no API call here.
 */
import { useCallback, useEffect, useRef } from "react";

import { useVoice } from "../voice/VoiceSession";
import { pageHasUserGesture } from "./founderVoice";

export type ReadAloud = {
  /** True when the "Read aloud" button should show. */
  available: boolean;
  readAloud(): void;
};

export function useReadAloud(lines: readonly string[] | null, allowed = true): ReadAloud {
  const { provider, enabled, say, stopSpeaking } = useVoice();
  const active = allowed && provider !== null && enabled;
  // Set when the first response arrives, spoken or not: a later re-render, a changed row or
  // turning voice on afterwards never repeats the arrival read (the #97 duplicate guard).
  const arrived = useRef(false);

  const speak = useCallback(
    (text: readonly string[]) => {
      text.forEach((line) => {
        say(line).catch(() => undefined);
      });
    },
    [say],
  );

  useEffect(() => {
    if (lines === null || arrived.current) return;
    arrived.current = true;
    if (active && pageHasUserGesture()) speak(lines);
  }, [lines, active, speak]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const readAloud = useCallback(() => {
    if (!active || lines === null) return;
    stopSpeaking();
    speak(lines);
  }, [active, lines, stopSpeaking, speak]);

  return { available: active && lines !== null, readAloud };
}
