import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { ConsentCaption, MicErrorLine, UnsupportedCaption } from "../../chloe/ui/VoiceCaptions";
import { VoiceModeButton } from "../../chloe/ui/VoiceModeButton";
import { VoiceModeAnnouncer, VoicePanel } from "../../chloe/ui/VoicePanel";
import { useChloe } from "../../chloe/useChloe";

type ComposerProps = Readonly<{
  busy: boolean;
  onSend(text: string): void;
  onUseForm(): void;
}>;

/**
 * The founder's composer: a two-line text area, Send, the voice-mode mic, and the "Use the form
 * instead" fallback. In voice mode (D-55) the voice panel takes the input row's place; the typed
 * draft is kept and comes back when voice mode ends, with focus on "Start voice mode" (or the
 * reply box if that button is gone) unless the founder has already moved focus elsewhere.
 */
export function Composer({ busy, onSend, onUseForm }: ComposerProps) {
  const [text, setText] = useState("");
  const chloe = useChloe();
  const inVoiceMode = chloe !== null && chloe.voiceMode.phase !== "off";
  const micButton = useRef<HTMLButtonElement>(null);
  const reply = useRef<HTMLTextAreaElement>(null);
  // "Voice mode ended" is announced only after it has been on (state adjusted during render).
  const [wasInVoiceMode, setWasInVoiceMode] = useState(inVoiceMode);
  const [voiceModeEnded, setVoiceModeEnded] = useState(false);
  if (wasInVoiceMode !== inVoiceMode) {
    setWasInVoiceMode(inVoiceMode);
    setVoiceModeEnded(!inVoiceMode);
  }

  const leftVoiceMode = !inVoiceMode && voiceModeEnded;
  useEffect(() => {
    if (!leftVoiceMode) return;
    // The panel (and the focused End button) is gone; a focus the founder chose stays put.
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const mic = micButton.current;
    if (mic && !mic.disabled) mic.focus();
    else reply.current?.focus();
  }, [leftVoiceMode]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      {inVoiceMode ? (
        <VoicePanel />
      ) : (
        <form
          onSubmit={submit}
          aria-busy={busy}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-4 focus-within:border-accent-green"
        >
          <label htmlFor="founder-reply" className="sr-only">
            Reply to assistant
          </label>
          <textarea
            ref={reply}
            id="founder-reply"
            name="reply"
            autoComplete="off"
            rows={2}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Reply here…"
            className="w-full resize-none border-0 bg-transparent leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-[13px] text-ink-3">Plain language: dates, budget, team roles.</span>
            <div className="flex items-center gap-2">
              <VoiceModeButton onDictation={setText} buttonRef={micButton} />
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      )}
      <VoiceModeAnnouncer ended={voiceModeEnded} />
      <MicErrorLine />
      <ConsentCaption />
      <UnsupportedCaption />
      <div className="px-1">
        <button
          type="button"
          onClick={onUseForm}
          className="inline-flex min-h-11 items-center text-[13px] text-ink-2 underline underline-offset-4 hover:text-accent-green sm:min-h-0"
        >
          Use the form instead
        </button>
      </div>
    </div>
  );
}
