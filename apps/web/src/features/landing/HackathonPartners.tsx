/**
 * "Our partners" on the landing page: the real organisations behind the hackathon (display only,
 * no API call, nothing here touches the seed graph or MeTTa). A partner with a url is an external
 * link; one without is a plain card, never a dead "#".
 */
import { ArrowUpRight } from "lucide-react";

import { HACKATHON_PARTNERS, secondLine, type HackathonPartner } from "./hackathonPartners";

const CARD = "flex h-full flex-col justify-between gap-6 rounded-card border border-border bg-surface p-4 md:p-5";

function PartnerCard({ partner }: Readonly<{ partner: HackathonPartner }>) {
  const line = secondLine(partner);
  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere] md:text-[15px]">{partner.name}</span>
        {partner.url && <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />}
      </span>
      {line && <span className={`text-xs text-ink-muted ${line.mono ? "font-mono" : ""}`}>{line.text}</span>}
    </>
  );
  if (!partner.url) return <div className={CARD}>{content}</div>;
  return (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${partner.name} (opens in a new tab)`}
      className={`${CARD} transition-colors hover:border-accent-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ground`}
    >
      {content}
    </a>
  );
}

export function HackathonPartners() {
  return (
    <section
      id="hackathon-partners"
      data-testid="landing-section-hackathon-partners"
      data-section="hackathon-partners"
      aria-labelledby="hackathon-partners-heading"
      className="w-full scroll-mt-16 bg-ground px-6 py-20"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accent-green">
              Our partners
            </span>
            <h2 id="hackathon-partners-heading" className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl">
              Built with the BASIX ecosystem.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">
            The organisations hosting, mentoring and amplifying Venture Route. Select one to visit their site.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {HACKATHON_PARTNERS.map((partner) => (
            <li key={partner.name}>
              <PartnerCard partner={partner} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
