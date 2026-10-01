import { AudioLines } from "lucide-react";
import type { Ref } from "react";

import { useRouting } from "../../state/routingContext";
import { useChloe } from "../useChloe";

type VoiceModeButtonProps = Readonly<{
  /** Keyless engine: a dictated utterance goes to the reply box instead of being sent. */
  onDictation(text: string): void;
  /** Lets the composer return focus here when voice mode ends. */
  buttonRef?: Ref<HTMLButtonElement>;
}>;

/**
 * The mic in the composer (#128, D-55): one tap enters voice mode, ChatGPT / Claude style, and
 * turns voice on first if it is off (the greeting is spoken inside this tap). Absent with no
 * provider or an unsupported browser; disabled while a request is in flight, exactly like Send.
 */
export function VoiceModeButton({ onDictation, buttonRef }: VoiceModeButtonProps) {
  const chloe = useChloe();
  const { state } = useRouting();
  if (!chloe || !chloe.provider || !chloe.supported) return null;
  const { voiceMode } = chloe;

  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid="mic-button"
      aria-label="Start voice mode"
      title="Start voice mode"
      disabled={state.busy}
      onClick={() => voiceMode.start({ onDictation })}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-strong text-ink-2 transition-colors hover:border-accent-green hover:text-accent-green focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <AudioLines aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
