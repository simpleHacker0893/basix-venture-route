import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { LogoMark } from "./Logo";

/**
 * The Stitch footer (design/stitch/batch-2/landing-page, D-36), on every route: brand block with
 * the tagline and the main call to action, three link columns, and a bottom bar.
 */
const COLUMNS: { heading: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", to: "/#how-it-works" },
      { label: "Evidence & rules", to: "/#evidence" },
      { label: "For builders", to: "/#for-builders" },
      { label: "Demo scenarios", to: "/route" },
    ],
  },
  {
    heading: "Ecosystem",
    links: [
      // Verified 2026-09-23 (#79): basixmarket.io redirects to basix.market, "BASIX Omniversity
      // Incubator", whose /lms is the MeTTa cohort learning platform; metta-lang.dev is the MeTTa
      // site the Hyperon README names. /partners is rendered from the seed graph (fictional), so it
      // says so; the real hackathon partners are a landing section.
      { label: "BASIX", to: "https://basix.market/", external: true },
      { label: "MeTTa OmniUniversity", to: "https://basix.market/lms", external: true },
      { label: "SingularityNET MeTTa", to: "https://metta-lang.dev/", external: true },
      { label: "Ecosystem partners (demo)", to: "/partners" },
      { label: "Hackathon partners", to: "/#hackathon-partners" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", to: "/sign-in" },
      { label: "Create a founder account", to: "/sign-up" },
      { label: "Create a builder profile", to: "/sign-up" },
      { label: "Admin", to: "/admin" },
    ],
  },
];

const REPO = "https://github.com/simpleHacker0893/basix-venture-route";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-dark bg-dark px-6 py-14 text-[#a7b8b0]">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 pb-10 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 font-display text-xl font-semibold text-white">
              <LogoMark />
              Venture Route
            </div>
            <p className="mt-3 max-w-xs leading-relaxed text-ink-subtle">
              A founding team you can verify. MeTTa rules decide, every match shows its evidence.
            </p>
            <Link
              to="/route"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-on-dark px-5 py-3 text-sm font-semibold text-dark transition-colors hover:bg-white md:w-auto"
            >
              Route my venture
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accent-on-dark">
                {column.heading}
              </h2>
              <ul className="space-y-1 text-ink-subtle sm:space-y-2">
                {column.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-1.5 transition-colors hover:text-white sm:py-0"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link to={link.to} className="inline-block py-1.5 transition-colors hover:text-white sm:py-0">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col items-start justify-between gap-4 border-t border-border-dark pt-8 text-sm md:flex-row md:items-center">
          <div className="flex items-center gap-6 text-xs">
            <span>© 2026 Venture Route</span>
            <a href={`${REPO}/blob/master/docs/PRD.md`} className="inline-block py-2 underline decoration-ink-subtle/40 underline-offset-4 hover:text-white sm:py-0">
              PRD
            </a>
            <Link to="/privacy" className="inline-block py-2 underline decoration-ink-subtle/40 underline-offset-4 hover:text-white sm:py-0">
              Privacy
            </Link>
          </div>
          <p className="flex items-start gap-2 text-xs text-ink-subtle md:items-center">
            <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-fill md:mt-0" />
            Built for the BASIX hackathon, SingularityNET MeTTa track. Seed records are fictional demo data; hackathon
            partners are real organisations.
          </p>
        </div>
      </div>
    </footer>
  );
}
