/**
 * One bid, as a row on Home or a card on the venture page. The skills are the engine's
 * `eligibleSkills`, rendered exactly as returned (same set, same order); nothing here compares or
 * filters skills (AGENTS.md rule 1). "Propose interview" and "View profile" are plain links.
 */
import type { Bid } from "@venture-route/contracts";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { initials, profileHref, proposeHref } from "./ventureStage";

const OUTLINE = "inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-surface-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent-green sm:h-10";
const SOLID = "inline-flex h-11 items-center justify-center rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-green-hover sm:h-10";

function Skills({ bid, label }: Readonly<{ bid: Bid; label?: string }>) {
  if (bid.eligibleSkills.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {label ? <span className="text-[12px] text-ink-3">{label}</span> : null}
      {bid.eligibleSkills.map((skill) => (
        <span key={skill} className="inline-flex h-6 items-center rounded-pill bg-credential-tint px-2.5 text-[12px] font-semibold text-accent-green">
          {SKILL_LABELS[skill]}
        </span>
      ))}
    </span>
  );
}

type BidCardProps = Readonly<{
  bid: Bid;
  /** "row" on Home (compact, shows the request it is for); "card" on the venture page. */
  variant: "row" | "card";
}>;

export function BidCard({ bid, variant }: BidCardProps) {
  const card = variant === "card";
  return (
    <li
      aria-label={`Bid from ${bid.displayName}`}
      className={
        card
          ? "flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-4 sm:flex-row sm:items-center sm:p-5"
          : "flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
      }
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`grid shrink-0 place-items-center rounded-full bg-sage font-semibold text-accent-green ${card ? "h-12 w-12 text-[15px]" : "h-10 w-10 text-[13px]"}`}
        >
          {initials(bid.displayName)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={`font-semibold text-ink ${card ? "text-[16px]" : "text-[15px]"}`}>{bid.displayName}</span>
            <span className="font-mono text-[13px] text-ink-2">{usd(bid.dayRate)}</span>
            {bid.demoData ? <DemoDataPill /> : null}
          </span>
          <Skills bid={bid} label={card ? "Verified for" : undefined} />
          {!card ? <span className="min-w-0 break-words text-[13px] text-ink-3">for {bid.requestTitle}</span> : null}
          {bid.message ? <span className="min-w-0 break-words text-[13px] leading-relaxed text-ink-2">“{bid.message}”</span> : null}
        </div>
      </div>
      <div className={`flex shrink-0 flex-col gap-2 ${card ? "sm:min-w-[160px]" : "sm:flex-row"}`}>
        <Link to={proposeHref(bid)} className={SOLID}>
          Propose interview
        </Link>
        <Link to={profileHref(bid)} className={OUTLINE}>
          View profile
        </Link>
      </div>
    </li>
  );
}
