import { useChloe } from "../useChloe";

/**
 * The "Voice: Chloe" switch (blueprint `chloe/ui/VoiceToggle.tsx`). Absent with no provider
 * (`off`, offline demo); disabled when the browser lacks the speech APIs. Minimal markup:
 * ticket #100 styles it from the batch-5 export without rewiring.
 */
export function VoiceToggle() {
  const chloe = useChloe();
  if (!chloe || !chloe.provider) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={chloe.enabled}
      disabled={!chloe.supported}
      onClick={chloe.toggleVoice}
      className="h-8 rounded-pill border border-border bg-surface-strong px-3 text-[13px] text-ink-2 aria-checked:border-accent-green aria-checked:text-ink disabled:opacity-60"
    >
      Voice: Chloe
    </button>
  );
}
