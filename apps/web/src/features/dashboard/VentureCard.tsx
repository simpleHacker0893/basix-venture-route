/**
 * One published request on Home: title, meta line, the five steps (a stage chip and "Step N of 5"
 * on phones) and the one button that matches its stage. `View route` re-routes the stored brief
 * through the engine exactly as before.
 */
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Stepper } from "../../components/Stepper";
import { MODE_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { StatusBadge } from "../route/Badges";
import { STAGES, stageStates, type VentureView } from "./ventureStage";

type VentureCardProps = Readonly<{
  view: VentureView;
  routing: boolean;
  routingBusy: boolean;
  onViewRoute(): void;
}>;

export function VentureCard({ view, routing, routingBusy, onViewRoute }: VentureCardProps) {
  const { request, bids, bookings, current } = view;
  const states = stageStates(current);
  const builders = request.route.builderIds.length;
  return (
    <li
      aria-label={request.title}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] lg:items-center lg:gap-7"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="min-w-0 break-words text-[17px] font-semibold leading-snug text-ink sm:text-[18px]">{request.title}</h3>
          {request.demoData ? <DemoDataPill /> : null}
        </span>
        <span className="font-mono text-[12.5px] text-ink-2">
          {usd(request.dailyBudget)} · {MODE_LABELS[request.deliveryMode]} · {builders} {builders === 1 ? "builder" : "builders"}
        </span>
        <button
          type="button"
          onClick={onViewRoute}
          disabled={routingBusy}
          className="inline-flex min-h-11 w-fit items-center text-[14px] font-semibold text-accent-green hover:underline disabled:opacity-60 sm:min-h-0 sm:py-1"
        >
          {routing ? "Routing…" : "View route"}
        </button>
      </div>

      {/* Phones: the current stage as a chip. From md up: all five steps. */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <span className="inline-flex h-7 items-center rounded-pill bg-credential-tint px-3 text-[12px] font-semibold text-accent-green">
          {view.stageLabel}
        </span>
        <span className="text-[12px] text-ink-3">
          Step {view.stepNumber} of {STAGES.length}
        </span>
      </div>
      <div className="hidden md:block">
        <Stepper
          ariaLabel={`${request.title} progress`}
          layout="row"
          size="sm"
          steps={STAGES.map((label, index) => ({
            label: index === 3 && bids.length > 0 ? `Bids (${bids.length})` : label,
            state: states[index]!,
            hint:
              index === 1
                ? <StatusBadge status={request.routeStatus} />
                : index === 2
                  ? request.status === "open"
                    ? "Open request"
                    : "Closed"
                  : index === 4 && bookings.length > 0
                    ? `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`
                    : undefined,
          }))}
        />
      </div>

      <Link
        to={view.cta.to}
        className="inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-surface-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent-green sm:h-10"
      >
        {view.cta.label}
      </Link>
    </li>
  );
}
