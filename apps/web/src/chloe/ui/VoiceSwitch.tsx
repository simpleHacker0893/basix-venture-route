type VoiceSwitchProps = Readonly<{
  enabled: boolean;
  supported: boolean;
  onToggle(): void;
  className?: string;
}>;

/**
 * The "Voice: Chloe" switch markup, shared by the intake header (#100) and the top nav (#102).
 * Presentational only: both callers pass the one voice session's state (ruling R6).
 */
export function VoiceSwitch({ enabled, supported, onToggle, className = "pb-1" }: VoiceSwitchProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-[13px] font-medium text-ink">Voice: Chloe</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Voice: Chloe"
        disabled={!supported}
        onClick={onToggle}
        className="relative h-6 w-11 rounded-full border border-border bg-border-strong p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-accent-green aria-checked:border-accent-green aria-checked:bg-accent-green disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`block h-5 w-5 rounded-full bg-surface-strong transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
