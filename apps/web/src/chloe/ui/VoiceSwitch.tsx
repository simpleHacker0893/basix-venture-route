import { Volume2, VolumeX } from "lucide-react";

type VoiceSwitchProps = Readonly<{
  enabled: boolean;
  supported: boolean;
  onToggle(): void;
  className?: string;
}>;

/**
 * The "Voice: Chloe" switch, shared by the intake header (#100) and the top nav (#102), drawn as
 * the refined UI's voice-guide pill: speaker, "Voice guide / Chloe", divider, switch.
 * Presentational only: both callers pass the one voice session's state (ruling R6). The switch
 * keeps the accessible name "Voice: Chloe" that the suites and assistive tech rely on.
 */
export function VoiceSwitch({ enabled, supported, onToggle, className = "pb-1" }: VoiceSwitchProps) {
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <div className={className}>
      <div className="inline-flex h-10 items-center gap-2.5 rounded-pill border border-border/60 bg-surface-strong/85 py-1 pl-3.5 pr-2 shadow-[0_1px_2px_rgba(20,26,23,0.04)]">
        <Icon aria-hidden="true" className={`h-[15px] w-[15px] ${enabled ? "text-ink-3" : "text-ink-subtle"}`} strokeWidth={2} />
        <span aria-hidden="true" className="flex flex-col leading-none">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-ink-3">Voice guide</span>
          <span className="mt-[3px] text-[13px] font-semibold text-ink">Chloe</span>
        </span>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Voice: Chloe"
          disabled={!supported}
          onClick={onToggle}
          className="relative h-5 w-9 shrink-0 rounded-full before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] bg-border-strong p-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-strong aria-checked:bg-accent-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className={`block h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
  );
}
