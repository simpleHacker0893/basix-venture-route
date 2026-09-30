/**
 * /dashboard (design/refined-ui founder dashboard): a founder's next step, each published request
 * as a pipeline (brief, route, published, bids, interview), the bids to review and the upcoming
 * interviews, then the counts. One call to the dashboard endpoint; every number and state comes
 * from it (counts are computed from SQL, Must 4). "View route" re-routes the stored brief through
 * the engine and opens the route flow (spec #52 story 11). Interview times are the engine's
 * Africa/Nairobi strings (D-16). The skills shown on a bid are the engine's `eligibleSkills`,
 * displayed as-is; nothing here compares skills (AGENTS.md rule 1).
 */
import type { Bid, Booking, Dashboard, Request } from "@venture-route/contracts";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { useAuthState } from "../../auth/authContext";
import { dashboardReadAloud } from "../../chloe/script";
import { ReadAloudButton } from "../../chloe/ui/ReadAloudButton";
import { SpeakingIndicator } from "../../chloe/ui/SpeakingIndicator";
import { useReadAloud } from "../../chloe/useReadAloud";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { formatNairobi, formatNairobiTime } from "../../lib/nairobi";
import { useRouting } from "../../state/routingContext";
import { errorMessage } from "../builder/formStyles";
import { StatusBadge } from "../route/Badges";

const STATE_LABEL: Record<Booking["state"], string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  countered: "Countered",
  confirmed: "Confirmed",
};
const STATE_PILL: Record<Booking["state"], string> = {
  proposed: "bg-surface text-ink-2 border border-border-strong",
  accepted: "bg-project-tint text-project",
  countered: "bg-amber-fill text-amber-ink",
  confirmed: "bg-credential-tint text-accent-green",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function greeting(name: string | null | undefined): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}

/** Today's calendar date in Africa/Nairobi, to group interviews; display only. */
function nairobiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

type NextStep = Readonly<{ lead: string; highlight?: string; tail?: string; cta: string; to: string }>;

function nextStep(data: Dashboard): NextStep {
  if (data.bidsReceived.length > 0) {
    const byRequest = new Map<string, Bid[]>();
    for (const bid of data.bidsReceived) byRequest.set(bid.requestId, [...(byRequest.get(bid.requestId) ?? []), bid]);
    const [top] = [...byRequest.values()].sort((a, b) => b.length - a.length);
    const count = top?.length ?? 0;
    return {
      lead: "You have ",
      highlight: `${count} ${count === 1 ? "bid" : "bids"}`,
      tail: ` on ${top?.[0]?.requestTitle ?? "your request"}.`,
      cta: "Review bids",
      to: "#bids",
    };
  }
  const next = data.upcomingBookings[0];
  if (next) {
    return {
      lead: "Your next interview is with ",
      highlight: next.displayName,
      tail: ` · ${formatNairobi(next.proposedStartLocal)}.`,
      cta: "Open interview",
      to: `/bookings/${encodeURIComponent(next.id)}`,
    };
  }
  if (data.requests.length > 0) {
    return { lead: "Your requests are open. Bids from eligible builders appear here.", cta: "Route another venture", to: "/route" };
  }
  return { lead: "Route your first venture: describe your MVP and see the evidence behind every match.", cta: "Describe your MVP", to: "/route" };
}

type StageState = "done" | "current" | "todo";

function Pipeline({ request, bids, bookings }: Readonly<{ request: Request; bids: number; bookings: Booking[] }>) {
  const confirmed = bookings.filter((b) => b.state === "confirmed").length;
  const current = bookings.length > 0 ? 4 : bids > 0 ? 3 : 2;
  const stages: ReadonlyArray<{ label: string; detail: React.ReactNode }> = [
    { label: "Brief", detail: "Confirmed" },
    { label: "Route", detail: <StatusBadge status={request.routeStatus} /> },
    { label: "Published", detail: request.status === "open" ? "Open request" : "Closed" },
    { label: bids > 0 ? `Bids (${bids})` : "Bids", detail: bids > 0 ? (current === 3 ? "you are here" : `${bids} received`) : "—" },
    {
      label: "Interview",
      detail: bookings.length > 0 ? (confirmed > 0 ? `${confirmed} confirmed` : `${bookings.length} upcoming`) : "—",
    },
  ];
  return (
    <ol aria-label={`${request.title} progress`} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-0">
      {stages.map((stage, index) => {
        const state: StageState = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={stage.label} aria-current={state === "current" ? "step" : undefined} className="relative flex gap-3 sm:flex-col sm:gap-2.5">
            <span className="relative flex items-center sm:w-full">
              <span
                aria-hidden="true"
                className={`relative z-10 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                  state === "done"
                    ? "bg-accent-green"
                    : state === "current"
                      ? "border-[3px] border-accent-green bg-accent-on-dark ring-4 ring-accent-green/15"
                      : "border-2 border-border-strong bg-surface-strong"
                }`}
              />
              {index < stages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-4 right-0 top-1/2 hidden h-[2px] -translate-y-1/2 sm:block ${index < current ? "bg-accent-green" : "bg-border"}`}
                />
              ) : null}
            </span>
            <span className="flex flex-col gap-1">
              <span className={`text-[15px] font-semibold ${state === "current" ? "text-accent-green" : state === "todo" ? "text-ink-3" : "text-ink"}`}>
                {stage.label}
              </span>
              <span className={`text-[13.5px] ${state === "current" ? "text-accent-green" : "text-ink-3"}`}>{stage.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DashboardPage() {
  const api = useMarketplaceApi();
  const auth = useAuthState();
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
  const step = data ? nextStep(data) : null;
  const anyDemo = data ? [...data.requests, ...data.bidsReceived, ...data.upcomingBookings].some((row) => row.demoData) : false;
  const today = nairobiToday();
  const todays = data?.upcomingBookings.filter((b) => b.proposedStartLocal.startsWith(today)) ?? [];
  const later = data?.upcomingBookings.filter((b) => !b.proposedStartLocal.startsWith(today)) ?? [];
  const budgetOf = (requestId: string) => data?.requests.find((r) => r.id === requestId)?.dailyBudget ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <h1 className="sr-only">Home</h1>
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

      {data && counts && step ? (
        <>
          <section
            aria-label="Next step"
            className="flex flex-col gap-5 rounded-3xl bg-dark px-6 py-7 text-white sm:px-10 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-on-dark">Next step</span>
                {anyDemo ? <DemoDataPill tone="strong" /> : null}
              </span>
              <p className="font-display text-[24px] leading-snug tracking-[-0.01em] sm:text-[30px]">
                {greeting(auth.user?.firstName)} {step.lead}
                {step.highlight ? <span className="text-accent-on-dark">{step.highlight}</span> : null}
                {step.tail}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <ReadAloudButton readAloud={readAloud} />
              <Link
                to={step.to}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-on-dark px-6 text-[15px] font-semibold text-dark transition-colors hover:bg-[#9ad9bb]"
              >
                {step.cta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section id="ventures" aria-labelledby="ventures-heading" className="flex scroll-mt-24 flex-col gap-4">
            <h2 id="ventures-heading" className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">
              Your ventures
            </h2>
            {data.requests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
                <p className="text-[15px] text-ink-2">No briefs published yet. Route a brief and publish it as a request.</p>
                <Link to="/route" className="-my-2 inline-flex items-center gap-1.5 py-2.5 text-[14px] font-semibold text-accent-green hover:underline">
                  Describe your MVP
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul aria-label="Briefs and routes" className="flex flex-col gap-4">
                {data.requests.map((request) => {
                  const requestBids = data.bidsReceived.filter((b) => b.requestId === request.id).length;
                  const requestBookings = data.upcomingBookings.filter((b) => b.requestId === request.id);
                  return (
                    <li
                      key={request.id}
                      aria-label={request.title}
                      className="flex flex-col gap-6 rounded-2xl border border-border bg-surface-strong p-5 sm:p-7"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-[18px] font-semibold text-ink sm:text-[20px]">{request.title}</h3>
                          <span className="text-[13.5px] text-ink-3">
                            {VERTICAL_LABELS[request.vertical]} · team of {request.route.builderIds.length} ·{" "}
                            {usd(request.route.totalDailyRate)} of {usd(request.dailyBudget)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {request.demoData ? <DemoDataPill /> : null}
                          <button
                            type="button"
                            onClick={() => void viewRoute(request)}
                            disabled={routing !== null}
                            className="-my-2 py-2.5 text-[15px] font-semibold text-accent-green hover:underline disabled:opacity-60"
                          >
                            {routing === request.id ? "Routing…" : "View route"}
                          </button>
                        </div>
                      </div>
                      <Pipeline request={request} bids={requestBids} bookings={requestBookings} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section
              id="bids"
              aria-labelledby="bids-heading"
              className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-surface-strong"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-7">
                <h2 id="bids-heading" className="text-[18px] font-semibold text-ink sm:text-[20px]">
                  Bids to review
                </h2>
                <span className="text-[13.5px] text-ink-3">From confirmed builders</span>
              </div>
              {data.bidsReceived.length === 0 ? (
                <p className="px-5 py-8 text-[15px] text-ink-3 sm:px-7">No bids yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {data.bidsReceived.map((bid) => {
                    const budget = budgetOf(bid.requestId);
                    const share = budget ? Math.min(100, Math.round((bid.dayRate / budget) * 100)) : null;
                    return (
                      <li key={bid.id} className="flex flex-col gap-4 px-5 py-5 sm:px-7 2xl:flex-row 2xl:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sage text-[14px] font-semibold text-accent-green">
                            {initials(bid.displayName)}
                          </span>
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[16px] font-semibold text-ink">{bid.displayName}</span>
                              <span className="text-[14px] text-ink-3">{bid.eligibleSkills.map((s) => SKILL_LABELS[s]).join(", ")}</span>
                              {bid.demoData ? <DemoDataPill /> : null}
                            </span>
                            <span className="truncate text-[14px] text-ink-3">
                              for {bid.requestTitle}
                              {bid.message ? ` · “${bid.message}”` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:pl-16 2xl:flex-nowrap 2xl:pl-0">
                          <div className="flex w-36 flex-col gap-2">
                            <span className="font-mono text-[14px] text-ink">{usd(bid.dayRate)}</span>
                            {share !== null ? (
                              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-border">
                                <span className="block h-full rounded-pill bg-accent-green" style={{ width: `${share}%` }} />
                              </span>
                            ) : null}
                          </div>
                          <Link
                            to={`/builders/${encodeURIComponent(bid.builderId)}`}
                            className="inline-flex h-11 items-center rounded-xl border border-border-strong bg-surface-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-ink-subtle"
                          >
                            View profile
                          </Link>
                          <Link
                            to={`/bookings/new?builder=${encodeURIComponent(bid.builderId)}&request=${encodeURIComponent(bid.requestId)}`}
                            className="inline-flex h-11 items-center rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-green-hover"
                          >
                            Book interview
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              id="interviews"
              aria-labelledby="interviews-heading"
              className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-border bg-surface-strong px-5 py-5 sm:px-7"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="interviews-heading" className="text-[18px] font-semibold text-ink sm:text-[20px]">
                  Interviews
                </h2>
                <span className="text-[13.5px] text-ink-3">Times in EAT</span>
              </div>
              {data.upcomingBookings.length === 0 ? (
                <p className="text-[15px] text-ink-3">No interviews booked yet.</p>
              ) : (
                <>
                  {[
                    ["Today", todays],
                    ["Coming up", later],
                  ].map(([label, list]) =>
                    (list as Booking[]).length > 0 ? (
                      <div key={label as string} className="flex flex-col gap-3">
                        <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-3">{label as string}</span>
                        <ul className="flex flex-col gap-3">
                          {(list as Booking[]).map((booking) => (
                            <li key={booking.id} className="flex gap-4 rounded-xl border border-border bg-surface p-4">
                              <span className="flex w-20 shrink-0 flex-col font-mono text-ink">
                                {label === "Today" ? null : (
                                  <span className="text-[12px] text-ink-3">{formatNairobi(booking.proposedStartLocal).split(" · ")[0]}</span>
                                )}
                                <span className="text-[17px] font-semibold">{formatNairobiTime(booking.proposedStartLocal).replace(" EAT", "")}</span>
                              </span>
                              <span className="flex min-w-0 flex-col gap-1.5">
                                <Link
                                  to={`/bookings/${encodeURIComponent(booking.id)}`}
                                  className="text-[16px] font-semibold text-ink hover:text-accent-green hover:underline"
                                >
                                  {booking.displayName}
                                  {booking.requestTitle ? ` · ${booking.requestTitle}` : ""}
                                </Link>
                                <span className="text-[13.5px] text-ink-3">
                                  {formatNairobi(booking.proposedStartLocal)} · {booking.durationMin} min
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className={`rounded-pill px-2.5 py-0.5 text-[12.5px] font-medium ${STATE_PILL[booking.state]}`}>
                                    {STATE_LABEL[booking.state]}
                                  </span>
                                  {booking.demoData ? <DemoDataPill /> : null}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </>
              )}
              <p className="text-[12.5px] text-ink-3">Times are shown in Africa/Nairobi (UTC+3).</p>
            </section>
          </div>

          <section
            aria-label="Counts"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1"
          >
            {(
              [
                ["briefs", String(counts.briefs), "briefs"],
                ["routes", `${counts.routes.feasible} · ${counts.routes.partial}`, `feasible · partial routes${counts.routes.infeasible ? ` · ${counts.routes.infeasible} infeasible` : ""}`],
                ["openRequests", String(counts.openRequests), counts.openRequests === 1 ? "open request" : "open requests"],
                ["bidsReceived", String(counts.bidsReceived), counts.bidsReceived === 1 ? "bid" : "bids"],
                ["bookings", String(counts.bookings), counts.bookings === 1 ? "booking" : "bookings"],
              ] as const
            ).map(([id, value, label]) => (
              <div key={id} data-testid="tile" data-tile={id} className="flex flex-col gap-1 bg-surface-strong px-6 py-5">
                <span data-testid="tile-count" className="font-display text-[30px] leading-none text-ink">
                  {value}
                </span>
                <span className="text-[13.5px] text-ink-3">{label}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
