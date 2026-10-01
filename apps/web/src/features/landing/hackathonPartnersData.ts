/**
 * The real organisations behind the BASIX hackathon, shown on the landing page. Display only:
 * these are not seed-graph records, never reach the engine or MeTTa, and carry no Demo data pill
 * (the fictional partners live in the seed graph and on /partners). Never guess a URL: a partner
 * with no `url` renders as a plain card with no link.
 */
export type HackathonPartner = Readonly<{
  name: string;
  /** The card's second line. When absent, `detail`, then the url's domain, is shown instead. */
  role?: string;
  detail?: string;
  url?: string;
}>;

export const HACKATHON_PARTNERS: ReadonlyArray<HackathonPartner> = [
  { name: "SingularityNET", url: "https://singularitynet.io/" },
  { name: "XR Agency", url: "https://xragency.org/" },
  { name: "BASIX.MARKET", role: "Host, NFT infrastructure", url: "https://basix.market" },
  { name: "BGI Comms", role: "Help desk & community", url: "https://bgicommons.org/" },
  { name: "iCog Labs", role: "Developers & mentors", url: "https://t.me/s/icoglabsofficial/186" },
  { name: "BeyondTheCode.ai", role: "Media & documentation", url: "https://beyondthecode.ai" },
  { name: "Cognitive Sprints", role: "BASIX.Market Dev Rel", url: "https://cognitive-sprints.in" },
  { name: "Rejuve Bio", url: "https://www.rejuve.bio/" },
  { name: "Blockwee", role: "Media partners" },
  {
    name: "Engineering Students Association, KU",
    detail: "Kenyatta University",
    url: "https://ke.linkedin.com/company/engineering-students-association-kenyatta-university",
  },
];

/** The card's second line: the role, else the detail, else the url's domain (in mono, as designed). */
export function secondLine(partner: HackathonPartner): { text: string; mono: boolean } | null {
  if (partner.role) return { text: partner.role, mono: false };
  if (partner.detail) return { text: partner.detail, mono: false };
  if (partner.url) return { text: new URL(partner.url).hostname.replace(/^www\./, ""), mono: true };
  return null;
}
