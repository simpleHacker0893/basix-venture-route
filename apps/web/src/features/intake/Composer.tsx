import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type ComposerProps = Readonly<{
  busy: boolean;
  onSend(text: string): void;
  onUseForm(): void;
}>;

/** The founder's composer: a two-line text area, Send, and the "Use the form instead" fallback. */
export function Composer({ busy, onSend, onUseForm }: ComposerProps) {
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={submit}
        aria-busy={busy}
        className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-4 focus-within:border-accent-green"
      >
        <label htmlFor="founder-reply" className="sr-only">
          Reply to assistant
        </label>
        <textarea
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
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
      <div className="px-1">
        <button
          type="button"
          onClick={onUseForm}
          className="text-[13px] text-ink-2 underline hover:text-accent-green"
        >
          Use the form instead
        </button>
      </div>
    </div>
  );
}
