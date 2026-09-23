import { Link } from "react-router";

import { useRouting } from "../state/routingContext";

/** requirements.md Edge cases: API unreachable → a banner with "Use the form instead", never a blank screen. */
export function ApiBanner() {
  const { state } = useRouting();
  if (!state.unreachable) return null;
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-fill bg-amber-fill/40 px-4 py-3 text-sm text-amber-ink"
    >
      <span>{state.unreachable}</span>
      <Link to="/route?mode=form" className="font-medium underline">
        Use the form instead
      </Link>
    </div>
  );
}
