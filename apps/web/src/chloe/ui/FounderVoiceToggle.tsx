import { useAuthState } from "../../auth/authContext";
import { useRouting } from "../../state/routingContext";
import { useVoice } from "../../voice/VoiceSession";
import { useFounderVoice } from "../founderVoice";
import { VoiceSwitch } from "./VoiceSwitch";

/**
 * The founder-wide "Voice: Chloe" switch in `TopNav` (#102): signed-in founders only; absent
 * with no provider (`VITE_VOICE_PROVIDER=off`, offline demo, or none injected) and whenever the
 * offline snapshot is the source.
 */
export function FounderVoiceToggle({ className }: Readonly<{ className?: string }>) {
  const auth = useAuthState();
  const voice = useVoice();
  const founder = useFounderVoice();
  const { source } = useRouting();
  const isFounder = auth.isLoaded && auth.isSignedIn && auth.role === "founder";
  if (!isFounder || !founder || !voice.provider || source.kind === "offline") return null;
  return <VoiceSwitch enabled={voice.enabled} supported={voice.supported} onToggle={founder.toggle} className={className} />;
}
