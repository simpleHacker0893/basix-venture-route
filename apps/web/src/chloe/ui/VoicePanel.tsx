import { Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useChloe } from "../useChloe";
import { VOICE_MODE_LABELS, type ActivePhase } from "../voiceMode";

/** The orb's look per state; `motion-reduce:` switches every animation off. */
const ORB_CLASSES: Record<ActivePhase, string> = {
  listening: "bg-accent-green shadow-[0_0_0_10px_rgba(30,90,69,0.12)]",
  thinking: "bg-ink-3 animate-pulse",
  speaking: "bg-accent-green animate-pulse",
  muted: "bg-border-strong",
};

/** Largest extra scale the live mic level can add to the orb while listening. */
const MAX_LEVEL_SCALE = 0.35;

/**
 * Voice mode's panel (#128, D-55), shown in place of the composer's input row: the state orb
 * (tap it while Chloe speaks to interrupt her), the state label, the live caption, Mute and End.
 * The state is announced through a polite live region; Escape ends voice mode (useVoiceMode).
 */
export function VoicePanel() {
  const chloe = useChloe();
  const orb = useRef<HTMLSpanElement>(null);
  const phase = chloe?.voiceMode.phase ?? "off";
  const subscribeLevel = chloe?.subscribeLevel;

  // The level drives the orb's scale straight on the element: no React render per audio frame.
  useEffect(() => {
    const element = orb.current;
    if (!element) return;
    element.style.transform = "";
    if (phase !== "listening" || !subscribeLevel) return;
    return subscribeLevel((level) => {
      element.style.transform = `scale(${1 + Math.min(level * 4, MAX_LEVEL_SCALE)})`;
    });
  }, [phase, subscribeLevel]);

  if (!chloe || phase === "off") return null;
  const { voiceMode, interim, nowSpeaking } = chloe;
  const muted = phase === "muted";
  const caption =
    phase === "listening"
      ? interim || "Go ahead, I'm listening."
      : phase === "speaking"
        ? (nowSpeaking ?? "")
        : phase === "thinking"
          ? "Working on it…"
          : "The mic is paused.";

  return (
    <section
      aria-label="Voice mode"
      data-testid="voice-panel"
      data-phase={phase}
      className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-strong px-4 py-6 shadow-card"
    >
      <button
        type="button"
        aria-label="Interrupt"
        title={phase === "speaking" ? "Interrupt Chloe" : undefined}
        disabled={phase !== "speaking"}
        onClick={voiceMode.interrupt}
        className="flex h-32 w-32 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer"
      >
        <span
          ref={orb}
          aria-hidden="true"
          className={`block h-20 w-20 rounded-full transition-transform duration-100 motion-reduce:animate-none motion-reduce:transition-none ${ORB_CLASSES[phase]}`}
        />
      </button>
      <p aria-live="polite" data-testid="voice-mode-state" className="text-[13px] font-medium uppercase tracking-wider text-ink">
        {VOICE_MODE_LABELS[phase]}
      </p>
      <p className="min-h-10 max-w-prose text-center text-[15px] leading-relaxed text-ink-2">{caption}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={muted ? voiceMode.unmute : voiceMode.mute}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface-strong px-4 text-[13px] font-medium text-ink-2 transition-colors hover:border-accent-green hover:text-accent-green focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {muted ? <Mic aria-hidden="true" className="h-4 w-4" /> : <MicOff aria-hidden="true" className="h-4 w-4" />}
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          aria-label="End voice mode"
          title="End voice mode (Esc)"
          onClick={voiceMode.end}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface-strong text-ink-2 transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
