import { useContext } from "react";

import { VoiceContext } from "../../voice/voiceContext";

/**
 * The status row shown only while Chloe is actually speaking: under the chat thread, under the
 * route summary, and on /dashboard and /bookings/:id (#102, ruling R23). It reads the voice
 * session directly, so it works outside /route's ChloeProvider. "Stop Chloe" calls the session's
 * `stopSpeaking`, which cancels the utterance in flight and bumps the queue generation so every
 * line still waiting is dropped (Sprint 006 acceptance Should 2).
 */
export function SpeakingIndicator() {
  const voice = useContext(VoiceContext);
  if (!voice || voice.status !== "speaking") return null;
  return (
    <div role="status" className="flex items-center justify-between px-2 pb-2 pt-1">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-green" />
        <span className="text-[13px] text-ink-2">Chloe is speaking</span>
      </div>
      <button
        type="button"
        onClick={voice.stopSpeaking}
        className="text-[13px] text-ink-2 underline transition-colors hover:text-ink"
      >
        Stop Chloe
      </button>
    </div>
  );
}
