import { OFFLINE_BANNER } from "../api/offline";
import { useRouting } from "../state/routingContext";

/** Shown whenever the offline snapshot is the source (VITE_OFFLINE_DEMO=1, D-34). */
export function OfflineBanner() {
  const { source } = useRouting();
  if (source.kind !== "offline") return null;
  return (
    <div
      role="status"
      aria-label={OFFLINE_BANNER}
      className="border-b border-amber-fill bg-amber-fill/40 px-6 py-2 text-center text-[13px] text-amber-ink"
    >
      {OFFLINE_BANNER}: the five demo routes come from a snapshot the engine generated; no network is used.
    </div>
  );
}
