/**
 * The pitch video facade (spec #86 story 41, prompt 6.2): a 16:9 block with a "Play pitch"
 * button and nothing else. No image, iframe or network request touches YouTube until the
 * visitor clicks; only then does the `youtube-nocookie.com` embed mount, exactly the id the
 * engine sent (named risk: third-party content must never load before the visitor asks).
 */
import { useState } from "react";

export function PitchVideo({ pitchVideoId }: Readonly<{ pitchVideoId: string | null }>) {
  const [playing, setPlaying] = useState(false);

  if (!pitchVideoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-card border border-border bg-surface-strong">
        <p className="text-sm text-ink-3">No pitch video</p>
      </div>
    );
  }

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-card border border-border bg-surface-strong">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${pitchVideoId}?autoplay=1`}
          title="Pitch video"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface-strong">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="inline-flex h-12 items-center gap-2 rounded-pill bg-accent-green px-5 text-sm font-medium text-white shadow-sm hover:bg-accent-green-hover"
      >
        <span aria-hidden="true" className="text-base">
          ▶
        </span>
        Play pitch
      </button>
      <p className="text-[13px] text-ink-3">Pitch video · loads from YouTube when you press play</p>
    </div>
  );
}
