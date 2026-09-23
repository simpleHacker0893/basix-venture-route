import type { ReasoningPath } from "@venture-route/contracts";

type PathFactsProps = Readonly<{ path: ReasoningPath; label?: string }>;

/** The ordered source facts of one ReasoningPath, exactly as written in the space. */
export function PathFacts({ path, label = "Source facts" }: PathFactsProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] uppercase tracking-wider text-ink-3">{label}</span>
      <ol className="flex flex-col gap-1">
        {path.facts.map((fact, index) => (
          <li key={`${index}-${fact}`} className="flex gap-2 text-[13px]">
            <span className="w-5 shrink-0 text-right font-mono text-ink-3">{index + 1}.</span>
            <code data-testid="fact" className="font-mono text-ink">
              {fact}
            </code>
          </li>
        ))}
      </ol>
    </div>
  );
}
