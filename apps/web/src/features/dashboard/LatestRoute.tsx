/**
 * "Your latest route": the most recent request's route snapshot as the dashboard returns it
 * (status, builder count, total hourly rate). The gap count is not part of the snapshot, so it is
 * not shown; "Why this route?" opens the engine's reasoning in the existing drawer.
 */
import type { Request } from "@venture-route/contracts";

import { usdPerHour } from "../../lib/format";
import { StatusBadge } from "../route/Badges";

type LatestRouteProps = Readonly<{
  request: Request;
  busy: boolean;
  error: string | null;
  onWhy(): void;
  /** "card" on Home, "strip" on the venture page. */
  variant?: "card" | "strip";
}>;

export function LatestRoute({ request, busy, error, onWhy, variant = "card" }: LatestRouteProps) {
  const builders = request.route.builderIds.length;
  const why = (
    <button
      type="button"
      onClick={onWhy}
      disabled={busy}
      className="inline-flex min-h-11 w-fit items-center text-left text-[14px] font-semibold text-accent-green hover:underline disabled:opacity-60 sm:min-h-0 sm:py-1"
    >
      {busy ? "Loading the reasoning…" : variant === "card" ? "Why this route? See the rules and facts →" : "Why this route? →"}
    </button>
  );
  const problem = error ? (
    <p role="alert" className="text-[13px] text-danger">
      {error}
    </p>
  ) : null;

  if (variant === "strip") {
    return (
      <section aria-label="Route result" className="flex flex-col gap-3 rounded-2xl border border-[#c9dfd3] bg-[#eef5f1] p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <StatusBadge status={request.routeStatus} />
        <span className="flex-1 text-[15px] font-medium text-ink">
          {builders} {builders === 1 ? "builder" : "builders"} · {usdPerHour(request.route.totalHourlyRate)}
        </span>
        <div className="flex flex-col gap-1">
          {why}
          {problem}
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Latest route" className="flex flex-col gap-3 rounded-2xl border border-[#c9dfd3] bg-[#eef5f1] p-5">
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge status={request.routeStatus} />
        <span className="text-[13px] text-ink-2">Your latest route</span>
      </span>
      <span className="break-words text-[16px] font-semibold text-ink">{request.title}</span>
      <dl className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <dd className="font-display text-[24px] leading-none text-ink">{builders}</dd>
          <dt className="text-[12px] text-ink-3">{builders === 1 ? "builder" : "builders"}</dt>
        </div>
        <div className="flex flex-col gap-0.5">
          <dd className="font-display text-[24px] leading-none text-ink">USD {request.route.totalHourlyRate}</dd>
          <dt className="text-[12px] text-ink-3">an hour</dt>
        </div>
      </dl>
      {why}
      {problem}
    </section>
  );
}
