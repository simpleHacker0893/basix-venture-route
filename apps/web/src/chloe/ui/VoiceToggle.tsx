import { useChloe } from "../useChloe";
import { VoiceSwitch } from "./VoiceSwitch";

/**
 * The "Voice: Chloe" switch in the intake header (blueprint `chloe/ui/VoiceToggle.tsx`). Absent
 * with no provider (`off`, offline demo); disabled when the browser lacks the speech APIs. It
 * shows the same session state as the top-nav switch (#102, ruling R6).
 */
export function VoiceToggle() {
  const chloe = useChloe();
  if (!chloe || !chloe.provider) return null;
  return <VoiceSwitch enabled={chloe.enabled} supported={chloe.supported} onToggle={chloe.toggleVoice} />;
}
