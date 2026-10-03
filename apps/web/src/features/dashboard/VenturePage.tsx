/**
 * /ventures/:requestId (design F3): one published request. The vertical progress timeline, the
 * stored brief, the route result as the dashboard returns it, and the bids as cards. Built from the
 * dashboard response the shell already loaded (no extra endpoint): the request, then its bids and
 * bookings matched by `requestId`. "View route" re-routes the stored brief through the engine, the
 * same as on Home. Skills on a bid are the engine's `eligibleSkills`, shown as returned.
 */
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { Stepper } from "../../components/Stepper";
import { MODE_LABELS, SKILL_LABELS } from "../../lib/brief";
import { usdPerHour } from "../../lib/format";
import { useRouting } from "../../state/routingContext";
import { StatusBadge } from "../route/Badges";
import { BidCard } from "./BidCard";
import { useFounderDashboard } from "./founderDashboardContext";
import { LatestRoute } from "./LatestRoute";
import { useWhyRoute } from "./useWhyRoute";
import { STAGES, stageHints, stageStates, ventureView } from "./ventureStage";

export function VenturePage() {
  const { requestId = "" } = useParams();
  const founder = useFounderDashboard();
  const { routeBrief } = useRouting();
  const navigate = useNavigate();
  const why = useWhyRoute();
  const [routing, setRouting] = useState(false);
  const data = founder?.data ?? null;
  const loadError = founder?.error ?? null;
  const request = data?.requests.find((r) => r.id === requestId) ?? null;
  const view = request && data ? ventureView(request, data.bidsReceived, data.upcomingBookings) : null;

  async function viewRoute() {
    if (!request) return;
    setRouting(true);
    await routeBrief(request.brief);
    await navigate("/route");
  }

  const back = (
    <Link to="/dashboard#ventures" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[14px] font-medium text-accent-green hover:underline sm:min-h-0">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Ventures
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      {back}

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}
      {data === null && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading this venture…
        </p>
      ) : null}
      {data && !request ? (
        <section aria-label="Venture not found" className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-strong p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">We couldn’t find this venture</h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-ink-3">It may belong to another account or was removed. Your published requests are on Home.</p>
          <Link to="/dashboard#ventures" className="inline-flex h-11 items-center rounded-xl bg-accent-green px-5 text-[14px] font-semibold text-white hover:bg-accent-green-hover">
            Back to your ventures
          </Link>
        </section>
      ) : null}

      {request && view ? (
        <>
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="min-w-0 flex-1 break-words font-display text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
              {request.title}
            </h1>
            <span className="flex flex-wrap items-center gap-2">
              {request.demoData ? <DemoDataPill /> : null}
              <span className="inline-flex h-7 items-center rounded-pill bg-credential-tint px-3 text-[13px] font-semibold text-accent-green">
                {request.status === "open" ? "Published" : "Closed"}
              </span>
            </span>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <aside className="flex flex-col gap-4">
              <section aria-label="Progress" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
                <h2 className="text-[17px] font-semibold text-ink">Progress</h2>
                <Stepper
                  ariaLabel="Progress"
                  layout="column"
                  size="sm"
                  steps={(() => {
                    const states = stageStates(view.current);
                    const hints = stageHints(view);
                    return STAGES.map((label, index) => ({
                      label: index === 1 ? "Route found" : index === 0 ? "Brief confirmed" : label,
                      state: states[index]!,
                      hint: index === 1 ? <StatusBadge status={request.routeStatus} /> : hints[index],
                    }));
                  })()}
                />
              </section>

              <section aria-label="Brief" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
                <h2 className="text-[17px] font-semibold text-ink">Your brief</h2>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13.5px]">
                  <dt className="text-ink-3">Skills</dt>
                  <dd className="break-words font-medium text-ink">{request.brief.requiredSkills.map((s) => SKILL_LABELS[s]).join(", ")}</dd>
                  <dt className="text-ink-3">Delivery</dt>
                  <dd className="font-medium text-ink">{MODE_LABELS[request.deliveryMode]}</dd>
                  <dt className="text-ink-3">Team</dt>
                  <dd className="font-medium text-ink">
                    up to {request.brief.maximumTeamSize} {request.brief.maximumTeamSize === 1 ? "builder" : "builders"}
                  </dd>
                  <dt className="text-ink-3">Budget</dt>
                  <dd className="font-mono font-medium text-ink">{usdPerHour(request.hourlyBudget)}</dd>
                </dl>
                <button
                  type="button"
                  onClick={() => void viewRoute()}
                  disabled={routing}
                  className="inline-flex min-h-11 w-fit items-center text-[14px] font-semibold text-accent-green hover:underline disabled:opacity-60 sm:min-h-0 sm:py-1"
                >
                  {routing ? "Routing…" : "View route →"}
                </button>
              </section>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <LatestRoute variant="strip" request={request} busy={why.busy === request.id} error={why.error} onWhy={() => void why.open(request)} />
              {why.drawer}

              <section id="bids" aria-labelledby="venture-bids-heading" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 id="venture-bids-heading" className="text-[17px] font-semibold text-ink">
                      Bids
                    </h2>
                    <p className="text-[13.5px] text-ink-3">Builders who applied to work on this request.</p>
                  </div>
                  {view.bids.length > 0 ? (
                    <span className="inline-flex h-7 items-center rounded-pill bg-amber-fill px-3 text-[13px] font-semibold text-amber-ink">
                      {view.bids.length} to review
                    </span>
                  ) : null}
                </div>
                {view.bids.length === 0 ? (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong p-4">
                    <span className="text-[14px] font-medium text-ink">No bids yet</span>
                    <span className="text-[13.5px] text-ink-3">Builders who applied to this request show here.</span>
                  </div>
                ) : (
                  <ul aria-label="Bids" className="flex flex-col gap-3">
                    {view.bids.map((bid) => (
                      <BidCard key={bid.id} bid={bid} variant="card" />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
