import type { ReadAloud } from "../useReadAloud";

/** "Read aloud" on the founder screens (#102): shown only while voice is on. */
export function ReadAloudButton({ readAloud }: Readonly<{ readAloud: ReadAloud }>) {
  if (!readAloud.available) return null;
  return (
    <button
      type="button"
      onClick={readAloud.readAloud}
      className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-black/5"
    >
      Read aloud
    </button>
  );
}
