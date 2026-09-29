/**
 * One gallery tile (spec #86 story 37, Stitch 6.1 composed from batch-4/requests-board, Q-17):
 * a public, sign-in-free card. The 16:9 area is a plain placeholder with a play glyph and
 * "Pitch video" or "No video" — never a YouTube thumbnail image or an embed before a click
 * (that only happens on the detail page, #105, after a click).
 *
 * Shared piece owned by #104 (controller ruling R7): #105 imports this for its own layout, it
 * does not edit it.
 */
import type { ShowcaseCard as ShowcaseCardT } from "@venture-route/contracts";
import { Link } from "react-router";

import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { SkillMatchChip } from "./SkillMatchChip";

const MAX_SKILL_CHIPS = 3;

type CardLink = { label: string; href: string };

function externalLinks(card: ShowcaseCardT): CardLink[] {
  const links: CardLink[] = [];
  if (card.liveUrl) links.push({ label: "Live", href: card.liveUrl });
  if (card.demoUrl) links.push({ label: "Demo", href: card.demoUrl });
  if (card.pitchDeckUrl) links.push({ label: "Deck", href: card.pitchDeckUrl });
  return links;
}

export function ShowcaseCard({ card }: Readonly<{ card: ShowcaseCardT }>) {
  const shownSkills = card.skillIds.slice(0, MAX_SKILL_CHIPS);
  const hiddenCount = card.skillIds.length - shownSkills.length;
  const builderLine = [card.displayName, card.cohortId].filter((part): part is string => Boolean(part)).join(" · ");
  const links = externalLinks(card);

  return (
    <article
      aria-label={card.title}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-sm"
    >
      <div
        aria-hidden="true"
        className="flex aspect-video items-center justify-center gap-2 rounded-card bg-surface-strong text-[13px] text-ink-muted"
      >
        <span aria-hidden="true">▶</span>
        <span>{card.pitchVideoId ? "Pitch video" : "No video"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {card.demoData ? <DemoDataPill /> : null}
        {card.licensable ? (
          <span className="rounded-pill bg-accent-green/10 px-2 py-0.5 font-mono text-[11px] text-accent-green">
            Licensable
          </span>
        ) : null}
      </div>

      <h3 className="font-display text-lg font-semibold text-ink">
        <Link to={`/showcase/${encodeURIComponent(card.id)}`} className="hover:underline">
          {card.title}
        </Link>
      </h3>
      <p className="text-[13px] text-ink-muted">by {builderLine}</p>
      <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">{card.description}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-ink-subtle/30 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
          {VERTICAL_LABELS[card.vertical]}
        </span>
        {shownSkills.map((skillId) => (
          <span
            key={skillId}
            className="rounded-pill border border-border-strong px-2 py-0.5 font-mono text-[11px] text-ink-muted"
          >
            {SKILL_LABELS[skillId]}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span className="rounded-pill border border-border-strong px-2 py-0.5 font-mono text-[11px] text-ink-3">
            +{hiddenCount}
          </span>
        ) : null}
        {card.matchedSkill ? <SkillMatchChip skill={card.matchedSkill} /> : null}
      </div>

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-green underline underline-offset-4"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
