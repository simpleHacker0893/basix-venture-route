/**
 * First visit: a founder with no published requests. A welcome card with the two ways in, the four
 * steps of the flow and the three empty blocks Home will fill. No data here, only copy and links.
 */
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const HOW: { title: string; body: string }[] = [
  { title: "Describe your idea", body: "In plain language, by chat or form." },
  { title: "Confirm the brief", body: "Skills, dates, delivery mode, team size, budget." },
  { title: "See your route", body: "Verified builders, cost and any honest gaps." },
  { title: "Publish and interview", body: "Builders bid. You book a time inside the app." },
];

const EMPTY: { title: string; heading: string; body: string }[] = [
  { title: "Ventures", heading: "No ventures yet", body: "Your published requests appear here." },
  { title: "Bids", heading: "No bids yet", body: "Builders who applied to your request show here." },
  { title: "Interviews", heading: "Nothing booked", body: "Proposed and confirmed times show here." },
];

/** `readAloud` is Chloe's "Read aloud" control, kept on first visit too (it reads the counts). */
export function FounderWelcome({ readAloud }: Readonly<{ readAloud?: ReactNode }>) {
  return (
    <>
      <section aria-label="Get started" className="flex flex-col gap-4 rounded-3xl bg-accent-green p-6 text-white sm:gap-5 sm:p-10 lg:p-12">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#cfe4d9]">Welcome</span>
        <h2 className="max-w-3xl font-display text-[30px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px] lg:text-[46px]">
          Describe your idea. Get the smallest credible route.
        </h2>
        <p className="max-w-2xl text-[15px] leading-relaxed text-[#e3eee8] sm:text-[16px]">
          Tell us what you want to build. BASIX rules find verified builders, reusable work and a partner, and show you the proof for every choice.
        </p>
        <div className="flex flex-col gap-3 pt-1.5 sm:flex-row">
          <Link
            to="/route"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[16px] font-semibold text-accent-green transition-colors hover:bg-[#f3f1ea]"
          >
            Route my venture
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          {/* The demo briefs are the scenario chips on /route, so the entry is /route itself. */}
          <Link
            to="/route"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[#7faf99] px-5 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
          >
            Try a demo brief
          </Link>
          {readAloud}
        </div>
      </section>

      <ol aria-label="How it works" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {HOW.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-credential-tint font-mono text-[14px] font-semibold text-accent-green">
              {index + 1}
            </span>
            <span className="text-[16px] font-semibold text-ink">{step.title}</span>
            <span className="text-[13.5px] leading-relaxed text-ink-3">{step.body}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {EMPTY.map((block) => (
          <section key={block.title} aria-label={block.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-strong p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold text-ink">{block.title}</h2>
            <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong p-4">
              <span className="text-[14px] font-medium text-ink">{block.heading}</span>
              <span className="text-[13.5px] leading-snug text-ink-3">{block.body}</span>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
