/**
 * /requests (screen 10, Stitch batch-4/requests-board, D-36): a signed-in builder sees every
 * open request with the engine's verdict on it. One call to the requests list (the engine puts
 * `eligibility` on every item, #61); chips All, Eligible for me and the three verticals; sort by
 * deadline, budget or newest, client-side. The indicator reads "Eligible · <skills>" or
 * "Not eligible · <reason>" and the Bid button is disabled with that reason as its accessible
 * description when `eligible-builder` does not hold (AGENTS.md rule 1: the verdict is the
 * engine's, never computed here).
 *
 * Substitutions from the export (AGENTS.md rule 10, listed in the sprint report): the ledger
 * number, latency, invented request ids, founder names and organisations, the info and warning
 * glyphs, and the attestation-ledger copy are left out; the request id shown is the brief's id.
 */
import type { Bid, BuilderProfile, Request, Vertical } from "@venture-route/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { MODE_LABELS, SKILL_LABELS, VERTICAL_LABELS, VERTICALS } from "../../lib/brief";
import { dateRange, usd } from "../../lib/format";
import { errorMessage } from "../builder/formStyles";
import { BidDialog } from "./BidDialog";

type Sort = "deadline" | "budget" | "newest";
type Chip = "all" | "eligible" | Vertical;

const SORT_LABELS: Record<Sort, string> = {
  deadline: "Deadline (soonest)",
  budget: "Rate ceiling (highest)",
  newest: "Recently registered",
};

function isEligible(request: Request): boolean {
  return request.eligibility?.eligible === true && request.status === "open";
}

function sortRequests(requests: readonly Request[], sort: Sort): Request[] {
  const copy = [...requests];
  switch (sort) {
    case "deadline":
      return copy.sort((a, b) => a.availabilityEnd.localeCompare(b.availabilityEnd) || a.title.localeCompare(b.title));
    case "budget":
      return copy.sort((a, b) => b.dailyBudget - a.dailyBudget || a.title.localeCompare(b.title));
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function filterRequests(requests: readonly Request[], chip: Chip): Request[] {
  if (chip === "all") return [...requests];
  if (chip === "eligible") return requests.filter(isEligible);
  return requests.filter((request) => request.vertical === chip);
}

function chipClass(selected: boolean): string {
  return `inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
    selected
      ? "border-accent-green bg-accent-green text-white"
      : "border-border-strong bg-surface-strong text-ink hover:border-accent-green"
  }`;
}

export function RequestsBoard() {
  const api = useMarketplaceApi();
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [profile, setProfile] = useState<BuilderProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [chip, setChip] = useState<Chip>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [bidding, setBidding] = useState<Request | null>(null);
  /** Bids placed in this session, by request id: the card shows the bid instead of the button. */
  const [placed, setPlaced] = useState<Record<string, Bid>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .listRequests()
      .then((rows) => {
        if (!cancelled) setRequests(rows);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiNotFoundError) setNoProfile(true);
        else setLoadError(errorMessage(cause, "The requests could not be loaded."));
      });
    api
      .getProfile()
      .then((row) => {
        if (!cancelled) setProfile(row);
      })
      .catch(() => {
        // The strip is decoration; the list's own 404 says "no profile yet".
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const shown = useMemo(() => (requests ? sortRequests(filterRequests(requests, chip), sort) : []), [requests, chip, sort]);
  const eligibleCount = requests?.filter(isEligible).length ?? 0;
  const verifiedSkills = profile?.skills.filter((skill) => skill.status === "verified") ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
        <span className="text-ink-3">Builder console</span>
        <span aria-hidden="true" className="text-border-strong">
          /
        </span>
        <span className="font-medium text-ink">Open opportunities</span>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink">Open requests</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          You can bid only where the eligible-builder rule holds for your profile.
        </p>
        {profile ? (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-[13px]">
            <span className="text-ink">Active builder profile: {profile.displayName}</span>
            <span
              className={`rounded-pill px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                profile.confirmed ? "bg-accent-green text-white" : "bg-amber-fill text-amber-ink"
              }`}
            >
              {profile.confirmed ? "verified" : "pending"}
            </span>
            <span className="text-ink-3">Verified skills:</span>
            <span className="font-mono text-[12px] text-ink-muted">
              {verifiedSkills.length ? `(${verifiedSkills.map((skill) => skill.name).join(", ")})` : "(none yet)"}
            </span>
          </div>
        ) : null}
      </header>

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}
      {noProfile ? (
        <p className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
          Create your builder profile first, then the board shows where the engine finds you eligible.{" "}
          <Link to="/profile" className="text-accent-green underline underline-offset-4">
            Your profile
          </Link>
        </p>
      ) : null}
      {requests === null && loadError === null && !noProfile ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading open requests…
        </p>
      ) : null}

      {requests ? (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
              <button type="button" className={chipClass(chip === "all")} onClick={() => setChip("all")}>
                All ({requests.length})
              </button>
              <button type="button" className={chipClass(chip === "eligible")} onClick={() => setChip("eligible")}>
                Eligible for me ({eligibleCount})
              </button>
              {VERTICALS.map((vertical) => (
                <button
                  key={vertical}
                  type="button"
                  className={chipClass(chip === vertical)}
                  onClick={() => setChip((current) => (current === vertical ? "all" : vertical))}
                >
                  {VERTICAL_LABELS[vertical]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <span>Sort by:</span>
              <select
                aria-label="Sort by"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-9 rounded-card border border-border-strong bg-surface-strong px-2 text-sm"
              >
                {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-sm text-ink-muted">
              {requests.length === 0 ? "No open requests yet." : "Nothing matches this filter."}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {shown.map((request) => (
                <li key={request.id}>
                  <RequestCard request={request} placed={placed[request.id]} onBid={() => setBidding(request)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      {bidding ? (
        <BidDialog
          request={bidding}
          profile={profile}
          onClose={() => setBidding(null)}
          onPlaced={(bid) => {
            setPlaced((current) => ({ ...current, [bid.requestId]: bid }));
            setBidding(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RequestCard({
  request,
  placed,
  onBid,
}: Readonly<{ request: Request; placed?: Bid | undefined; onBid(): void }>) {
  const verdict = request.eligibility;
  const eligible = isEligible(request) && placed === undefined;
  const reasonId = `reason-${request.id}`;
  const eligibleSkills = new Set(verdict?.skills ?? []);
  const reason = verdict?.reason ?? "eligible-builder does not hold";
  const location = request.brief.location ? ` (${request.brief.location})` : "";
  return (
    <article
      aria-label={request.title}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm md:flex-row md:items-start md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {request.demoData ? <DemoDataPill /> : null}
          <span className="rounded border border-ink-subtle/30 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            {VERTICAL_LABELS[request.vertical]}
          </span>
          {request.status === "closed" ? (
            <span className="rounded-pill bg-danger px-2 py-0.5 text-[11px] font-medium text-white">Closed</span>
          ) : null}
          <span className="font-mono text-[11px] text-ink-3">
            Req ID: <span className="text-ink-muted">{request.brief.id}</span>
          </span>
        </div>
        <h2 className="font-display text-xl font-semibold text-ink">{request.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-ink-3">Skills:</span>
          {request.brief.requiredSkills.map((skill) => (
            <span
              key={skill}
              className={`rounded-pill border px-2 py-0.5 font-mono text-[11px] ${
                eligibleSkills.has(skill) ? "border-accent-green text-accent-green" : "border-border-strong text-ink-muted"
              }`}
            >
              {SKILL_LABELS[skill]}
              {eligibleSkills.has(skill) ? " ✓" : ""}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-ink-muted">
          <span>{dateRange(request.availabilityStart, request.availabilityEnd)}</span>
          <span aria-hidden="true" className="text-border-strong">
            |
          </span>
          <span>
            {MODE_LABELS[request.deliveryMode]}
            {location}
          </span>
        </div>
        {verdict === null ? null : verdict.eligible ? (
          <p data-testid="verdict" className="text-[13px] font-medium text-accent-green">
            Eligible · {verdict.skills.map((skill) => SKILL_LABELS[skill]).join(", ")}
          </p>
        ) : (
          <p data-testid="verdict" className="text-[13px] text-ink-muted">
            Not eligible · <span id={reasonId}>{reason}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Budget ceiling</span>
        <span className="font-mono text-sm text-ink">{usd(request.dailyBudget)}</span>
        {placed ? (
          <span className="rounded-pill bg-accent-green/10 px-2 py-0.5 font-mono text-[11px] text-accent-green">
            Bid placed · {usd(placed.dayRate)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onBid}
          disabled={!eligible}
          aria-describedby={placed || eligible ? undefined : reasonId}
          className="mt-2 rounded-md bg-accent-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:bg-border-strong disabled:text-ink-3"
        >
          {placed ? "Bid placed" : "Bid"}
        </button>
      </div>
    </article>
  );
}
