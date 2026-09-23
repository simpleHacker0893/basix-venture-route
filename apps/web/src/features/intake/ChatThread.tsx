import type { Turn } from "../../state/routingReducer";

type ChatThreadProps = Readonly<{ turns: Turn[] }>;

/** The dialogue between the founder and the assistant. Assistant text is the engine's message. */
export function ChatThread({ turns }: ChatThreadProps) {
  if (turns.length === 0) return null;
  return (
    <ol className="flex flex-col gap-6" aria-label="Conversation">
      {turns.map((turn, index) =>
        turn.role === "founder" ? (
          <li key={index} className="flex flex-col items-end" data-testid="founder-turn">
            <span className="mb-1 text-[13px] text-ink-3">You</span>
            <p className="max-w-[620px] rounded-card border border-border bg-surface-strong p-6 leading-relaxed">
              {turn.text}
            </p>
          </li>
        ) : (
          <li key={index} className="flex flex-col items-start" data-testid="assistant-turn">
            <span className="mb-1 text-[13px] text-ink-2">Assistant</span>
            <p className="w-full max-w-[680px] whitespace-pre-line rounded-card border border-border bg-surface p-6 leading-relaxed">
              {turn.text}
            </p>
          </li>
        ),
      )}
    </ol>
  );
}
