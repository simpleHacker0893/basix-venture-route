/**
 * /dashboard (screen 11, Stitch batch-4/founder-dashboard, D-36): a founder's briefs, routes,
 * requests, bids and interviews in one place. One call to the dashboard endpoint; the tiles map
 * one-to-one onto `counts`, which the engine computes from SQL (Must 4). "View route" re-routes
 * the stored brief through the engine and opens the route flow (spec #52 story 11: "re-route it
 * against today's graph"): the stored row holds only a route snapshot, so a fresh route, decided
 * by MeTTa, is the honest thing to show. Every interview time is the engine's Africa/Nairobi
 * string (D-16).
 *
 * Substitutions from the export (listed in the sprint report): "Export ledger CSV", "Join room",
 * "Reschedule", the Google Meet line, the invented cohort and organisation names, and the tile
 * captions that asserted things the product does not know ("Broadcasting to cohort").
 */
import type { Dashboard, Request } from "@venture-route/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { dashboardReadAloud } from "../../chloe/script";
import { ReadAloudButton } from "../../chloe/ui/ReadAloudButton";
import { SpeakingIndicator } from "../../chloe/ui/SpeakingIndicator";
import { useReadAloud } from "../../chloe/useReadAloud";
import { DemoDataPill } from "../../components/DemoDataPill";
import { VERTICAL_LABELS } from "../../lib/brief";
import { isoDate, usd } from "../../lib/format";
import { formatNairobi } from "../../lib/nairobi";
import { useRouting } from "../../state/routingContext";
import { errorMessage } from "../builder/formStyles";
import { StatusBadge } from "../route/Badges";

const STATE_LABEL: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  countered: "Countered",
  confirmed: "Confirmed",
};

function Tile({
  id,
  label,
  count,
  caption,
}: Readonly<{ id: string; label: string; count: number; caption: string }>) {
  return (
    <div data-testid="tile" data-tile={id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{label}</span>
      <span data-testid="tile-count" className="font-display text-3xl font-semibold text-ink">
        {count}
      </span>
      <span className="text-[12px] text-ink-muted">{caption}</span>
    </div>
  );
}

export function DashboardPage() {
  const api = useMarketplaceApi();
  const { routeBrief } = useRouting();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null);
  // Chloe reads the counts and the next interview (#102): templated from this one response only.
  const readAloud = useReadAloud(useMemo(() => (data ? [dashboardReadAloud(data)] : null), [data]));

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "The dashboard could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function viewRoute(request: Request) {
    setRouting(request.id);
    await routeBrief(request.brief);
    await navigate("/route");
  }

  const counts = data?.counts;
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-8">
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span>Founder workspace</span>
        <span aria-hidden="true" className="text-border-strong">
          ·
        </span>
        <span>Deterministic evaluation registry</span>
        <DemoDataPill />
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold text-ink">Your ventures</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Active venture briefs, deterministic routing outputs, and incoming builder candidate bids.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReadAloudButton readAloud={readAloud} />
          <Link
            to="/route"
            className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover"
          >
            New brief
          </Link>
        </div>
      </header>
      <SpeakingIndicator />

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}
      {data === null && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading your ventures…
        </p>
      ) : null}

      {data && counts ? (
        <>
          <section aria-label="Tiles" className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Tile id="briefs" label="Briefs" count={counts.briefs} caption="evaluated briefs" />
            <Tile
              id="routes"
              label="Routes"
              count={counts.routes.feasible + counts.routes.partial + counts.routes.infeasible}
              caption={`${counts.routes.feasible} feasible · ${counts.routes.partial} partial · ${counts.routes.infeasible} infeasible`}
            />
            <Tile id="openRequests" label="Open requests" count={counts.openRequests} caption="open for bids" />
            <Tile id="bidsReceived" label="Bids received" count={counts.bidsReceived} caption="from confirmed builders" />
            <Tile id="bookings" label="Bookings" count={counts.bookings} caption="interviews in every state" />
          </section>

          <section aria-labelledby="briefs-heading" className="flex flex-col gap-3">
            <h2 id="briefs-heading" className="font-display text-xl font-semibold text-ink">
              Briefs and routes
            </h2>
            {data.requests.length === 0 ? (
              <p className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-sm text-ink-muted">
                No briefs published yet. Route a brief and publish it as a request.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table aria-label="Briefs and routes" className="w-full text-left text-[13px]">
                  <thead className="border-b border-border font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    <tr>
                      <th className="px-4 py-3">Brief</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Day rate</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((request) => (
                      <tr key={request.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-ink">{request.title}</span>
                            <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                              {request.demoData ? <DemoDataPill /> : null}
                              {VERTICAL_LABELS[request.vertical]}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={request.routeStatus} />
                            <span className="font-mono text-[11px] text-ink-3">
                              {request.status === "open" ? "Open" : "Closed"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">{request.route.builderIds.length}</td>
                        <td className="px-4 py-3 font-mono">{usd(request.route.totalDailyRate)}</td>
                        <td className="px-4 py-3 text-ink-muted">{isoDate(request.createdAt.slice(0, 10))}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void viewRoute(request)}
                            disabled={routing !== null}
                            className="font-medium text-accent-green underline decoration-accent-green/40 underline-offset-4 disabled:opacity-60"
                          >
                            {routing === request.id ? "Routing…" : "View route"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section aria-labelledby="bids-heading" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
              <h3 id="bids-heading" className="font-display text-lg font-semibold text-ink">
                Bids received
              </h3>
              {data.bidsReceived.length === 0 ? (
                <p className="text-sm text-ink-muted">No bids yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.bidsReceived.map((bid) => (
                    <li key={bid.id} className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink">{bid.displayName}</span>
                        <span className="font-mono text-[12px] text-ink">{usd(bid.dayRate)}</span>
                      </div>
                      <span className="text-[12px] text-ink-muted">for {bid.requestTitle}</span>
                      {bid.message ? <p className="text-[13px] text-ink-2">{bid.message}</p> : null}
                      <div className="flex flex-wrap gap-3 text-[13px]">
                        <Link to={`/builders/${encodeURIComponent(bid.builderId)}`} className="text-accent-green underline underline-offset-4">
                          View profile
                        </Link>
                        <Link
                          to={`/bookings/new?builder=${encodeURIComponent(bid.builderId)}&request=${encodeURIComponent(bid.requestId)}`}
                          className="text-accent-green underline underline-offset-4"
                        >
                          Book interview
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="interviews-heading" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
              <h3 id="interviews-heading" className="font-display text-lg font-semibold text-ink">
                Upcoming interviews
              </h3>
              {data.upcomingBookings.length === 0 ? (
                <p className="text-sm text-ink-muted">No interviews booked yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.upcomingBookings.map((booking) => (
                    <li key={booking.id} className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <Link to={`/bookings/${encodeURIComponent(booking.id)}`} className="font-medium text-ink underline decoration-ink-muted/40 underline-offset-4 hover:text-accent-green">
                        {booking.displayName}
                        {booking.requestTitle ? ` · ${booking.requestTitle}` : ""}
                      </Link>
                      <span className="font-mono text-[12px] text-ink-muted">{formatNairobi(booking.proposedStartLocal)}</span>
                      <span className="text-[12px] text-ink-3">{STATE_LABEL[booking.state] ?? booking.state}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12px] text-ink-3">Times are shown in Africa/Nairobi (UTC+3).</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
