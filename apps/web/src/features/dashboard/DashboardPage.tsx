/**
 * /dashboard (design F1 first visit, F2 home): a founder's next step and latest route, the three
 * counts, each published request as a venture card, the bids to review and the upcoming
 * interviews. Everything comes from the one dashboard response the shell already loaded
 * (`useFounderDashboard`); counts are SQL counts, interview times are the engine's Africa/Nairobi
 * strings (D-16), and the skills on a bid are the engine's `eligibleSkills` shown as returned
 * (AGENTS.md rule 1: nothing here compares skills or ranks builders). A founder with no published
 * request sees the welcome card instead. "View route" re-routes the stored brief through the
 * engine and opens the route flow (spec #52 story 11).
 */
import type { Bid, Booking, Dashboard } from "@venture-route/contracts";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuthState } from "../../auth/authContext";
import { dashboardReadAloud } from "../../chloe/script";
import { ReadAloudButton } from "../../chloe/ui/ReadAloudButton";
import { SpeakingIndicator } from "../../chloe/ui/SpeakingIndicator";
import { useReadAloud } from "../../chloe/useReadAloud";
import { DemoDataPill } from "../../components/DemoDataPill";
import { formatNairobi, formatNairobiTime } from "../../lib/nairobi";
import { useRouting } from "../../state/routingContext";
import { BidCard } from "./BidCard";
import { FounderWelcome } from "./FounderWelcome";
import { founderCounts, useFounderDashboard } from "./founderDashboardContext";
import { LatestRoute } from "./LatestRoute";
import { useWhyRoute } from "./useWhyRoute";
import { VentureCard } from "./VentureCard";
import { latestRequest, ventureView } from "./ventureStage";

/** The founder-facing words for a booking's state (the engine owns the state itself). */
const STATE_LABEL: Record<Booking["state"], string> = {
  proposed: "Waiting for builder",
  accepted: "Builder accepted",
  countered: "Countered",
  confirmed: "Confirmed",
};
const STATE_PILL: Record<Booking["state"], string> = {
  proposed: "bg-amber-fill text-amber-ink",
  accepted: "bg-project-tint text-project",
  countered: "bg-amber-fill text-amber-ink",
  confirmed: "bg-credential-tint text-accent-green",
};

function greeting(name: string | null | undefined): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}

/** Today's calendar date in Africa/Nairobi, to group interviews; display only. */
function nairobiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

type NextStep = Readonly<{
  lead: string;
  highlight?: string;
  tail?: string;
  body?: string;
  cta: string;
  to: string;
  secondary?: Readonly<{ label: string; to: string }>;
}>;

function nextStep(data: Dashboard): NextStep {
  if (data.bidsReceived.length > 0) {
    const byRequest = new Map<string, Bid[]>();
    for (const bid of data.bidsReceived) byRequest.set(bid.requestId, [...(byRequest.get(bid.requestId) ?? []), bid]);
    const [top] = [...byRequest.values()].sort((a, b) => b.length - a.length);
    const count = top?.length ?? 0;
    const requestId = top?.[0]?.requestId;
    return {
      lead: "You have ",
      highlight: `${count} ${count === 1 ? "bid" : "bids"}`,
      tail: ` on ${top?.[0]?.requestTitle ?? "your request"}.`,
      body: "Review their evidence, then propose a time to talk. Every skill shown comes from BASIX rules, not from the builder.",
      cta: "Review bids",
      to: "#bids",
      secondary: requestId ? { label: "Open this venture", to: `/ventures/${encodeURIComponent(requestId)}` } : undefined,
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

export function DashboardPage() {
  const auth = useAuthState();
  const founder = useFounderDashboard();
  const { routeBrief } = useRouting();
  const navigate = useNavigate();
  const why = useWhyRoute();
  const [routing, setRouting] = useState<string | null>(null);
  const data = founder?.data ?? null;
  const loadError = founder?.error ?? null;
  // Chloe reads the counts and the next interview (#102): templated from this one response only.
  const readAloud = useReadAloud(useMemo(() => (data ? [dashboardReadAloud(data)] : null), [data]));

  async function viewRoute(requestId: string) {
    const request = data?.requests.find((r) => r.id === requestId);
    if (!request) return;
    setRouting(request.id);
    await routeBrief(request.brief);
    await navigate("/route");
  }

  const step = data ? nextStep(data) : null;
  const counts = data ? founderCounts(data) : null;
  const anyDemo = data ? [...data.requests, ...data.bidsReceived, ...data.upcomingBookings].some((row) => row.demoData) : false;
  const today = nairobiToday();
  const todays = data?.upcomingBookings.filter((b) => b.proposedStartLocal.startsWith(today)) ?? [];
  const later = data?.upcomingBookings.filter((b) => !b.proposedStartLocal.startsWith(today)) ?? [];
  const latest = data ? latestRequest(data.requests) : null;
  // Welcome only when there is nothing at all; a bid or booking always belongs to a published request.
  const firstVisit = data !== null && data.requests.length === 0 && data.bidsReceived.length === 0 && data.upcomingBookings.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-10 lg:py-8">
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

      {firstVisit ? <FounderWelcome readAloud={<ReadAloudButton readAloud={readAloud} />} /> : null}

      {data && counts && step && !firstVisit ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-stretch">
            <section aria-label="Next step" className="flex flex-col gap-4 rounded-3xl border border-border bg-surface-strong p-5 sm:p-8">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-green">Your next step</span>
                {anyDemo ? <DemoDataPill /> : null}
              </span>
              <span className="text-[14px] text-ink-3">{greeting(auth.user?.firstName)}</span>
              <p className="font-display text-[26px] leading-[1.12] tracking-[-0.02em] text-ink sm:text-[34px]">
                {step.lead}
                {step.highlight ? <span className="text-accent-green">{step.highlight}</span> : null}
                {step.tail}
              </p>
              {step.body ? <p className="max-w-xl text-[15px] leading-relaxed text-ink-2">{step.body}</p> : null}
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to={step.to}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-green px-5 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover sm:h-11"
                >
                  {step.cta}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                {step.secondary ? (
                  <Link
                    to={step.secondary.to}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-border-strong bg-surface-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-accent-green sm:h-11"
                  >
                    {step.secondary.label}
                  </Link>
                ) : null}
                <ReadAloudButton readAloud={readAloud} />
              </div>
            </section>
            {latest ? (
              <LatestRoute request={latest} busy={why.busy === latest.id} error={why.error} onWhy={() => void why.open(latest)} />
            ) : null}
          </div>
          {why.drawer}

          <section aria-label="Counts" className="grid grid-cols-3 gap-2 sm:gap-4">
            {(
              [
                ["ventures", counts.ventures, "Ventures", "Requests you published"],
                ["bids", counts.bids, "Bids", "Builders who applied"],
                ["interviews", counts.interviews, "Interviews", "Confirmed or proposed"],
              ] as const
            ).map(([id, value, label, sub]) => (
              <div key={id} data-testid="tile" data-tile={id} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-strong px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                <span data-testid="tile-count" className="font-display text-[26px] leading-none text-ink sm:min-w-9 sm:text-[36px]">
                  {value}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ink sm:text-[15px]">{label}</span>
                  <span className="hidden text-[13px] text-ink-3 sm:block">{sub}</span>
                </span>
              </div>
            ))}
          </section>

          <section id="ventures" aria-labelledby="ventures-heading" className="flex scroll-mt-24 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="ventures-heading" className="text-[18px] font-semibold text-ink">
                Your ventures
              </h2>
              <span className="text-[13px] text-ink-3">Each request moves left to right.</span>
            </div>
            {data.requests.length === 0 ? (
              <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-border-strong bg-surface-strong p-5">
                <span className="text-[14px] font-medium text-ink">No ventures yet</span>
                <span className="text-[13.5px] text-ink-3">Your published requests appear here.</span>
              </div>
            ) : (
              <ul aria-label="Briefs and routes" className="flex flex-col gap-3">
                {data.requests.map((request) => (
                  <VentureCard
                    key={request.id}
                    view={ventureView(request, data.bidsReceived, data.upcomingBookings)}
                    routing={routing === request.id}
                    routingBusy={routing !== null}
                    onViewRoute={() => void viewRoute(request.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
            <section
              id="bids"
              aria-labelledby="bids-heading"
              className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <h2 id="bids-heading" className="text-[18px] font-semibold text-ink">
                  Bids to review
                </h2>
                <p className="text-[13.5px] text-ink-3">Builders who applied to work on your published request.</p>
              </div>
              {data.bidsReceived.length === 0 ? (
                <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong p-4">
                  <span className="text-[14px] font-medium text-ink">No bids yet</span>
                  <span className="text-[13.5px] text-ink-3">Builders who applied to your request show here.</span>
                </div>
              ) : (
                <ul aria-label="Bids" className="flex flex-col divide-y divide-border">
                  {data.bidsReceived.map((bid) => (
                    <BidCard key={bid.id} bid={bid} variant="row" />
                  ))}
                </ul>
              )}
            </section>

            <section
              id="interviews"
              aria-labelledby="interviews-heading"
              className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <h2 id="interviews-heading" className="text-[18px] font-semibold text-ink">
                  Upcoming interviews
                </h2>
                <p className="text-[13.5px] text-ink-3">Times are in Nairobi time.</p>
              </div>
              {data.upcomingBookings.length === 0 ? (
                <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong p-4">
                  <span className="text-[14px] font-medium text-ink">Nothing booked</span>
                  <span className="text-[13.5px] text-ink-3">Proposed and confirmed times show here.</span>
                </div>
              ) : (
                [
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
                                className="break-words text-[16px] font-semibold text-ink hover:text-accent-green hover:underline"
                              >
                                {booking.displayName}
                                {booking.requestTitle ? ` · ${booking.requestTitle}` : ""}
                              </Link>
                              <span className="text-[13.5px] text-ink-3">
                                {formatNairobi(booking.proposedStartLocal)} · {booking.durationMin} min
                              </span>
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                )
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
