import { CONSENT_CAPTION, MIC_ERRORS, UNSUPPORTED_CAPTION } from "../script";
import { useChloe } from "../useChloe";

/** The mic error line (blueprint `VoiceCaptions.tsx` MicErrorLine): the same text Chloe speaks. */
export function MicErrorLine() {
  const chloe = useChloe();
  if (!chloe || !chloe.enabled || chloe.micError === null) return null;
  return (
    <p role="alert" data-testid="mic-error" className="text-[13px] text-danger">
      {MIC_ERRORS[chloe.micError]}
    </p>
  );
}

/**
 * The browser-speech privacy notice (blueprint `VoiceCaptions.tsx` ConsentCaption): shown once
 * the mic is actually usable, i.e. voice is on (an unsupported browser can never get here).
 */
export function ConsentCaption() {
  const chloe = useChloe();
  if (!chloe || !chloe.enabled) return null;
  return <p className="text-[13px] text-ink-3">{CONSENT_CAPTION}</p>;
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
