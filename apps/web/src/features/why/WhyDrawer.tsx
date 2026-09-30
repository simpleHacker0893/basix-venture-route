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
        className="w-full gap-0 overflow-y-auto overscroll-contain bg-ground shadow-drawer motion-reduce:animate-none motion-reduce:transition-none data-[side=right]:w-full data-[side=right]:border-l-0 sm:data-[side=right]:max-w-[var(--vr-drawer-width)] sm:data-[side=right]:border-l"
        aria-label="Why this route?"
      >
        <SheetHeader className="gap-1.5 border-b border-border px-7 pb-5 pt-6">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accent-green">Evidence chain</span>
          <SheetTitle className="font-display text-[28px] font-normal tracking-[-0.01em] text-ink">Why this route?</SheetTitle>
          <SheetDescription className="leading-relaxed text-ink-3">
            Every recommendation comes from a named MeTTa rule over source facts. Nothing here is
            written by a language model.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="founder" className="px-7 pb-8 pt-5">
          <TabsList aria-label="View" className="group-data-horizontal/tabs:h-10">
            <TabsTrigger value="founder" className="px-3">Founder view</TabsTrigger>
            <TabsTrigger value="technical" className="px-3">Technical view</TabsTrigger>
          </TabsList>
          <TabsContent value="founder" className="flex flex-col gap-4 pt-4" translate="no">
            {route.builders.map((builder) =>
              builder.evidencePaths.map((path, index) => {
                const skill = builder.covers[index] ?? builder.covers[0] ?? "";
                return (
                  <section
                    key={`${builder.builderId}-${skill}`}
                    data-testid={`path-builder-${builder.builderId}-${skill}`}
                    className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {builder.name} covers {skillLabel(skill)}
                      </h3>
                      <EvidenceBadge evidence={builder.evidenceType} />
                    </div>
                    <span className="self-start rounded-pill bg-credential-tint px-2.5 py-0.5 font-mono text-[12px] text-accent-green">{path.rule}</span>
                    <PathFacts path={path} />
                  </section>
                );
              }),
            )}
            {route.reusableIp && (
              <section data-testid="path-ip" className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-5">
                <h3 className="font-semibold">{route.reusableIp.title} is reusable IP</h3>
                <span className="self-start rounded-pill bg-credential-tint px-2.5 py-0.5 font-mono text-[12px] text-accent-green">{route.reusableIp.path.rule}</span>
                <PathFacts path={route.reusableIp.path} />
              </section>
            )}
            {route.cohort && (
              <section data-testid="path-cohort" className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-5">
                <h3 className="font-semibold">
                  {route.cohort.cohortId} of {route.cohort.universityId}
                </h3>
                <span className="self-start rounded-pill bg-credential-tint px-2.5 py-0.5 font-mono text-[12px] text-accent-green">{route.cohort.path.rule}</span>
                <PathFacts path={route.cohort.path} />
              </section>
            )}
            {route.partner && (
              <section data-testid="path-partner" className="flex flex-col gap-3 rounded-card border border-border bg-surface-strong p-5">
                <h3 className="font-semibold">{route.partner.partnerId} is a partner fit</h3>
                <span className="self-start rounded-pill bg-credential-tint px-2.5 py-0.5 font-mono text-[12px] text-accent-green">{route.partner.path.rule}</span>
                <PathFacts path={route.partner.path} label="Multi-hop proof" />
              </section>
            )}
            {route.gaps.length > 0 && (
              <section className="flex flex-col gap-2 rounded-card border border-danger/25 bg-danger-tint p-5">
                <h3 className="font-semibold text-danger">Gaps</h3>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {route.gaps.map((gap, index) => (
                    <li key={`${gap.category}-${index}`}>
                      <span className="font-mono text-danger">{gap.rule}</span> · {gap.statement}
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
                className="flex flex-col gap-2 rounded-card border border-border-dark bg-dark p-5 text-accent-on-dark"
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
                        <code data-testid="fact" className="break-words font-mono text-white">
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
