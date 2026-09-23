import type { VentureBrief, VentureRoute } from "@venture-route/contracts";
import { useState } from "react";
import { Link } from "react-router";

import { ApiBanner } from "../../components/ApiBanner";
import { Button } from "@/components/ui/button";
import type { BriefPatch } from "../../lib/nextActions";
import { useRouting } from "../../state/routingContext";
import { StatusBadge } from "./Badges";
import { BuilderCard } from "./BuilderCard";
import { ContextCards } from "./ContextCards";
import { CostStrip } from "./CostStrip";
import { EmptyTeam } from "./EmptyTeam";
import { GapsPanel } from "./GapsPanel";
import { WhyDrawer } from "../why/WhyDrawer";

type RouteResultProps = Readonly<{
  brief: VentureBrief;
  route: VentureRoute;
  onPatch(patch: BriefPatch): void;
  onChangeBrief(): void;
  onWhy?(builderId?: string): void;
}>;

/** Screen 5: badge, summary, cost strip, gaps first, team, context, rules applied. */
export function RouteResult({ brief, route, onPatch, onChangeBrief, onWhy }: RouteResultProps) {
  const teamHeading =
    route.builders.length > 0 ? `Team (${route.builders.length} of max ${brief.maximumTeamSize})` : "Team";
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[36px] font-medium leading-tight">Your route through BASIX</h1>
          <StatusBadge status={route.status} />
        </div>
        <p className="max-w-3xl text-ink-2">{route.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onChangeBrief}>
            Change brief
          </Button>
          <Button asChild variant="secondary">
            <Link to="/handoff">Export handoff</Link>
          </Button>
          {onWhy && (
            <Button type="button" onClick={() => onWhy()}>
              Why this route?
            </Button>
          )}
        </div>
      </section>

      <CostStrip totalDailyRate={route.totalDailyRate} dailyBudget={brief.dailyBudget} />

      {/* Gaps before team cards, in DOM order (AGENTS.md rule 6). */}
      <GapsPanel gaps={route.gaps} onPatch={onPatch} />

      <section data-testid="team-section" aria-labelledby="team-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="team-heading" className="text-xl font-semibold">
            {teamHeading}
          </h2>
          <p className="text-sm text-ink-2">
            Smallest verified team covering the required skills within team size and budget.
          </p>
        </div>
        {route.builders.length === 0 ? (
          <EmptyTeam />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {route.builders.map((builder) => (
              <BuilderCard key={builder.builderId} builder={builder} onViewEvidence={onWhy} />
            ))}
          </div>
        )}
      </section>

      <ContextCards route={route} vertical={brief.vertical} />

      <p className="text-[13px] text-ink-3">
        Rules applied:{" "}
        <span className="font-mono">{route.rulesApplied.join(" · ")}</span>
      </p>
    </div>
  );
}

export function RouteResultPage() {
  const { state, setBrief, showView } = useRouting();
  const [whyOpen, setWhyOpen] = useState(false);
  const response = state.lastResponse;
  if (!response || response.type !== "route") return null;
  return (
    <section className="flex flex-col gap-6">
      <ApiBanner />
      <RouteResult
        brief={response.brief}
        route={response.route}
        onChangeBrief={() => showView("review")}
        onWhy={() => setWhyOpen(true)}
        onPatch={(patch) => {
          setBrief({ ...response.brief, ...patch });
          showView("review");
        }}
      />
      <WhyDrawer route={response.route} open={whyOpen} onOpenChange={setWhyOpen} />
    </section>
  );
}
