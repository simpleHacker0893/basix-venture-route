import type { ReasoningPath } from "@venture-route/contracts";

type PathFactsProps = Readonly<{ path: ReasoningPath; label?: string }>;

/** The ordered source facts of one ReasoningPath, exactly as written in the space. */
export function PathFacts({ path, label = "Source facts" }: PathFactsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1" translate="no">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <ol className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5">
        {path.facts.map((fact, index) => (
          <li key={`${index}-${fact}`} className="flex gap-2 text-[12.5px] leading-relaxed">
            <span className="w-5 shrink-0 text-right font-mono text-ink-3">{index + 1}.</span>
            <code data-testid="fact" className="min-w-0 break-words font-mono text-ink-2">
              {fact}
            </code>
          </li>
        ))}
      </ol>
    </div>
  );
}
