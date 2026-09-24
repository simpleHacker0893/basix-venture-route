import { useEffect, useRef, type KeyboardEvent } from "react";

import { useRouting } from "../../state/routingContext";
import { useChloe } from "../useChloe";

type MicButtonProps = Readonly<{
  /** Keyless engine: the transcript goes to the reply box instead of being sent. */
  onDictation(text: string): void;
}>;

/**
 * Push-to-talk (blueprint `chloe/ui/MicButton.tsx`): pointer down/up or Space/Enter down/up.
 * Rendered only while voice is on; disabled while a request is in flight, exactly like Send.
 * Minimal markup: ticket #100 styles it without rewiring.
 */
export function MicButton({ onDictation }: MicButtonProps) {
  const chloe = useChloe();
  const { state } = useRouting();
  const held = useRef(false);
  // The release awaits the recogniser, so read the conductor's latest submitTranscript (busy,
  // confirmation state) at that moment rather than the one captured when the press rendered.
  const submitRef = useRef(chloe?.submitTranscript);
  useEffect(() => {
    submitRef.current = chloe?.submitTranscript;
  });
  // A disabled button never receives pointerup: forget the press so the next one is not ignored.
  useEffect(() => {
    if (state.busy) held.current = false;
  }, [state.busy]);

  if (!chloe || !chloe.enabled) return null;
  const { pressMic, releaseMic } = chloe;

  function press() {
    if (held.current) return;
    held.current = true;
    pressMic();
  }

  async function release() {
    if (!held.current) return;
    held.current = false;
    const text = await releaseMic();
    const submit = submitRef.current;
    if (submit && (await submit(text)) === "dictation") onDictation(text.trim());
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) press();
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    void release();
  }

  return (
    <button
      type="button"
      data-testid="mic-button"
      aria-label="Hold to talk"
      aria-pressed={chloe.status === "listening"}
      disabled={state.busy}
      onPointerDown={press}
      onPointerUp={() => void release()}
      onPointerLeave={() => void release()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className="h-9 rounded-pill border border-border px-3 text-[13px] text-ink-2 aria-pressed:border-accent-green disabled:opacity-60"
    >
      Hold to talk
    </button>
  );
}
