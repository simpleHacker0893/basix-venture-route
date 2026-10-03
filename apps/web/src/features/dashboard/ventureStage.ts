/**
 * Where a published request stands, worked out only from fields the dashboard already returns
 * (its status, its bids and its bookings). Nothing here compares skills or ranks anyone: the
 * engine decides eligibility and fit (AGENTS.md rule 1); this only reads counts and statuses.
 *
 * Every request on the dashboard is already published (publishing creates it), so the first three
 * steps are always done. The current step is Bids once a bid exists, Interview once a booking
 * exists, otherwise Published (waiting for bids).
 */
import type { Bid, Booking, Request } from "@venture-route/contracts";

import type { StepState } from "../../components/Stepper";
import { STATUS_LABEL } from "../../lib/format";

export const STAGES = ["Brief", "Route", "Published", "Bids", "Interview"] as const;
export type StageIndex = 0 | 1 | 2 | 3 | 4;

export function currentStage(bids: number, bookings: number): StageIndex {
  return bookings > 0 ? 4 : bids > 0 ? 3 : 2;
}

/** done before the current step, current at it, upcoming after. */
export function stageStates(current: StageIndex): StepState[] {
  return STAGES.map((_, index) => (index < current ? "done" : index === current ? "current" : "upcoming"));
}

export type VentureView = Readonly<{
  request: Request;
  bids: Bid[];
  bookings: Booking[];
  current: StageIndex;
  /** "Bids", "Interview"…: the current step's name, for the compact (phone) card. */
  stageLabel: string;
  /** 1-based, "Step N of 5". */
  stepNumber: number;
  cta: Readonly<{ label: "Review bids" | "Open venture"; to: string }>;
}>;

/** One request with its own bids and bookings (matched by `requestId`, in the order the API returned them). */
export function ventureView(request: Request, allBids: readonly Bid[], allBookings: readonly Booking[]): VentureView {
  const bids = allBids.filter((bid) => bid.requestId === request.id);
  const bookings = allBookings.filter((booking) => booking.requestId === request.id);
  const current = currentStage(bids.length, bookings.length);
  const base = `/ventures/${encodeURIComponent(request.id)}`;
  return {
    request,
    bids,
    bookings,
    current,
    stageLabel: STAGES[current],
    stepNumber: current + 1,
    cta: bids.length > 0 ? { label: "Review bids", to: `${base}#bids` } : { label: "Open venture", to: base },
  };
}

/** The plain-words line under each step on the venture page's timeline. */
export function stageHints(view: VentureView): string[] {
  const { request, bids, bookings } = view;
  const confirmed = bookings.filter((b) => b.state === "confirmed").length;
  const builders = request.route.builderIds.length;
  return [
    "Skills, delivery, budget",
    `${STATUS_LABEL[request.routeStatus]} · ${builders} ${builders === 1 ? "builder" : "builders"}`,
    request.status === "open" ? "Open to eligible builders" : "Closed",
    bids.length > 0 ? `${bids.length} to review` : "No bids yet",
    bookings.length > 0
      ? confirmed > 0
        ? `${confirmed} confirmed`
        : `${bookings.length} proposed`
      : bids.length > 0
        ? "Propose a time"
        : "—",
  ];
}

/** The founder's most recent request by creation time (display only; no ranking of builders). */
export function latestRequest(requests: readonly Request[]): Request | null {
  return requests.reduce<Request | null>((latest, r) => (latest === null || r.createdAt > latest.createdAt ? r : latest), null);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** A bid's two links: the builder's profile, and a new interview proposal for that builder on that request. */
export function profileHref(bid: Bid): string {
  return `/builders/${encodeURIComponent(bid.builderId)}`;
}

export function proposeHref(bid: Bid): string {
  return `/bookings/new?builder=${encodeURIComponent(bid.builderId)}&request=${encodeURIComponent(bid.requestId)}`;
}
