import { consentCaption, micErrorLine, UNSUPPORTED_CAPTION } from "../script";
import { useChloe } from "../useChloe";

/** The mic error line (blueprint `VoiceCaptions.tsx` MicErrorLine): the same text Chloe speaks. */
export function MicErrorLine() {
  const chloe = useChloe();
  if (!chloe || !chloe.enabled || chloe.micError === null) return null;
  return (
    <p role="alert" data-testid="mic-error" className="text-[13px] text-danger">
      {micErrorLine(chloe.micError, chloe.lastError)}
    </p>
  );
}

/**
 * The privacy notice (blueprint `VoiceCaptions.tsx` ConsentCaption): shown wherever the mic can
 * be used, so it sits next to "Start voice mode" before the first tap as well as in voice mode.
 * Absent with no provider or an unsupported browser. The text names the provider in use, read
 * from the session's `provider.kind` (D-53).
 */
export function ConsentCaption() {
  const chloe = useChloe();
  if (!chloe || !chloe.provider || !chloe.supported) return null;
  return <p className="text-[13px] text-ink-3">{consentCaption(chloe.provider?.kind)}</p>;
}

/**
 * The unsupported-browser notice (blueprint `VoiceCaptions.tsx` UnsupportedCaption): shown
 * whenever a voice provider exists but the browser lacks the speech APIs, whether or not the
 * (disabled) switch has ever been toggled.
 */
export function UnsupportedCaption() {
  const chloe = useChloe();
  if (!chloe || !chloe.provider || chloe.supported) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-border bg-surface p-3">
      <div>
        <span className="block text-[12px] font-medium uppercase tracking-wider text-ink">Unsupported browser</span>
        <p className="text-[13px] text-ink-2">{UNSUPPORTED_CAPTION}</p>
      </div>
    </div>
  );
}
