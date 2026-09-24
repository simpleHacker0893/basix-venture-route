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
    <div className="flex items-center gap-3 pb-1">
      <span className="text-[13px] font-medium text-ink">Voice: Chloe</span>
      <button
        type="button"
        role="switch"
        aria-checked={chloe.enabled}
        aria-label="Voice: Chloe"
        disabled={!chloe.supported}
        onClick={chloe.toggleVoice}
        className="relative h-6 w-11 rounded-full border border-border bg-border-strong p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-accent-green aria-checked:border-accent-green aria-checked:bg-accent-green disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`block h-5 w-5 rounded-full bg-surface-strong transition-transform ${chloe.enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
