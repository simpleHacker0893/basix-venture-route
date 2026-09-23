import type { VentureRoute } from "@venture-route/contracts";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { namedPaths, skillLabel } from "../../lib/reasoningPaths";
import { EvidenceBadge } from "../route/Badges";
import { PathFacts } from "./PathFacts";

type WhyDrawerProps = Readonly<{
  route: VentureRoute;
  open: boolean;
  onOpenChange(open: boolean): void;
}>;

/**
 * Screen 6 (D-31): a right-side sheet over the ReasoningPath objects already in the route.
 * Founder view: per builder one row per skill with its evidence badge and ordered facts, then
 * IP, cohort and partner. Technical view: the same paths as rule, monospace facts, conclusion.
 */
export function WhyDrawer({ route, open, onOpenChange }: WhyDrawerProps) {
  const paths = namedPaths(route);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto overscroll-contain bg-surface-strong motion-reduce:animate-none motion-reduce:transition-none sm:max-w-[var(--vr-drawer-width)]"
        aria-label="Why this route?"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-[28px] font-medium">Why this route?</SheetTitle>
          <SheetDescription>
            Every recommendation comes from a named MeTTa rule over source facts. Nothing here is
            written by a language model.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="founder" className="px-4 pb-6">
          <TabsList aria-label="View">
            <TabsTrigger value="founder">Founder view</TabsTrigger>
            <TabsTrigger value="technical">Technical view</TabsTrigger>
          </TabsList>
          <TabsContent value="founder" className="flex flex-col gap-4 pt-4" translate="no">
            {route.builders.map((builder) =>
              builder.evidencePaths.map((path, index) => {
                const skill = builder.covers[index] ?? builder.covers[0] ?? "";
                return (
                  <section
                    key={`${builder.builderId}-${skill}`}
                    data-testid={`path-builder-${builder.builderId}-${skill}`}
                    className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {builder.name} covers {skillLabel(skill)}
                      </h3>
                      <EvidenceBadge evidence={builder.evidenceType} />
                    </div>
                    <span className="font-mono text-[12px] text-ink-3">{path.rule}</span>
                    <PathFacts path={path} />
                  </section>
                );
              }),
            )}
            {route.reusableIp && (
              <section data-testid="path-ip" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <h3 className="font-semibold">{route.reusableIp.title} is reusable IP</h3>
                <span className="font-mono text-[12px] text-ink-3">{route.reusableIp.path.rule}</span>
                <PathFacts path={route.reusableIp.path} />
              </section>
            )}
            {route.cohort && (
              <section data-testid="path-cohort" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <h3 className="font-semibold">
                  {route.cohort.cohortId} of {route.cohort.universityId}
                </h3>
                <span className="font-mono text-[12px] text-ink-3">{route.cohort.path.rule}</span>
                <PathFacts path={route.cohort.path} />
              </section>
            )}
            {route.partner && (
              <section data-testid="path-partner" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <h3 className="font-semibold">{route.partner.partnerId} is a partner fit</h3>
                <span className="font-mono text-[12px] text-ink-3">{route.partner.path.rule}</span>
                <PathFacts path={route.partner.path} label="Multi-hop proof" />
              </section>
            )}
            {route.gaps.length > 0 && (
              <section className="flex flex-col gap-2 rounded-card border border-amber-fill bg-amber-fill/20 p-4">
                <h3 className="font-semibold">Gaps</h3>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {route.gaps.map((gap, index) => (
                    <li key={`${gap.category}-${index}`}>
                      <span className="font-mono text-ink-3">{gap.rule}</span> · {gap.statement}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </TabsContent>
          <TabsContent value="technical" className="flex flex-col gap-4 pt-4" translate="no">
            {paths.map(({ key, title, path }) => (
              <section
                key={key}
                data-testid="technical-path"
                className="flex flex-col gap-2 rounded-card bg-dark p-4 text-accent-on-dark"
              >
                <span className="text-[12px] uppercase tracking-wider text-accent-on-dark/70">{title}</span>
                <div className="flex gap-2 text-[13px]">
                  <span className="w-24 shrink-0 text-accent-on-dark/70">rule</span>
                  <code data-testid="technical-rule" className="font-mono">
                    {path.rule}
                  </code>
                </div>
                <div className="flex gap-2 text-[13px]">
                  <span className="w-24 shrink-0 text-accent-on-dark/70">facts</span>
                  <ol className="flex min-w-0 flex-col gap-0.5">
                    {path.facts.map((fact, index) => (
                      <li key={`${index}-${fact}`}>
                        <code data-testid="fact" className="break-all font-mono text-white">
                          {fact}
                        </code>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-2 text-[13px]">
                  <span className="w-24 shrink-0 text-accent-on-dark/70">conclusion</span>
                  <code data-testid="technical-conclusion" className="min-w-0 break-words font-mono text-white">
                    {path.conclusion}
                  </code>
                </div>
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
