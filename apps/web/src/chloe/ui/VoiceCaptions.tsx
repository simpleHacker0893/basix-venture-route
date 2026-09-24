import { MIC_ERRORS } from "../script";
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
