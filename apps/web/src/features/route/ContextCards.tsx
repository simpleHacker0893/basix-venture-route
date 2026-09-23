import type { VentureRoute } from "@venture-route/contracts";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS } from "../../lib/brief";

type ContextCardsProps = Readonly<{
  route: VentureRoute;
  vertical: string;
}>;

function ContextCard({
  testId,
  kind,
  title,
  children,
}: Readonly<{ testId: string; kind: string; title: string; children: React.ReactNode }>) {
  return (
    <article data-testid={testId} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] uppercase tracking-wider text-ink-3">{kind}</span>
        <DemoDataPill />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="text-sm text-ink-2">{children}</div>
    </article>
  );
}

/** Reusable IP, cohort and partner: only what the route carries (D-23), each a demo-data card. */
export function ContextCards({ route, vertical }: ContextCardsProps) {
  const { reusableIp, cohort, partner } = route;
  if (!reusableIp && !cohort && !partner) return null;
  return (
    <section aria-labelledby="context-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="context-heading" className="text-xl font-semibold">
          Context
        </h2>
        <p className="text-sm text-ink-2">Assets, cohorts and partners the rules connected to this brief.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {reusableIp && (
          <ContextCard testId="ip-card" kind="Reusable IP" title={reusableIp.title}>
            <p className="font-mono text-[13px]">{reusableIp.assetId}</p>
            <p>
              Licensable in {vertical}; demonstrates{" "}
              {reusableIp.path.conclusion.split("demonstrates ")[1]?.split(", ").map((s) => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(", ") ?? "a required skill"}.
            </p>
          </ContextCard>
        )}
        {cohort && (
          <ContextCard testId="cohort-card" kind="Cohort and university" title={`${cohort.cohortId} · ${cohort.universityId}`}>
            <p className="font-mono text-[13px]">{cohort.path.rule}</p>
            <p>Cohort of the first selected builder.</p>
          </ContextCard>
        )}
        {partner && (
          <ContextCard testId="partner-card" kind="Partner" title={partner.partnerId}>
            <p className="font-mono text-[13px]">{partner.path.rule}</p>
            <p>Supports the brief's vertical through the builder's university, four hops away.</p>
          </ContextCard>
        )}
      </div>
    </section>
  );
}
