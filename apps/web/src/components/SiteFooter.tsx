import { Link } from "react-router";

/**
 * The Stitch footer (design/stitch/batch-2/landing-page, D-36), on every route: wordmark and
 * tagline, three link columns, the bottom links and the copyright line. The export's Ecosystem
 * and Privacy links were `#` placeholders; here every link lands on a real page (the landing
 * sections, /ecosystem sections built from seed facts, /privacy).
 */
const COLUMNS: { heading: string; links: { label: string; to: string }[] }[] = [
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
      { label: "BASIX", to: "/ecosystem#basix" },
      { label: "MeTTa OmniUniversity", to: "/ecosystem#omni" },
      { label: "SingularityNET MeTTa", to: "/ecosystem#snet" },
      { label: "Partners", to: "/ecosystem#partners" },
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
    <footer className="mt-auto border-t border-[#26282d] bg-dark px-6 py-14 text-[#a3a29e]">
      <div className="mx-auto max-w-[1200px]">
        <div className="pb-10">
          <div className="font-display text-xl font-bold text-white">Venture Route</div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-subtle">
            Built for the BASIX hackathon, SingularityNET MeTTa track. All records are fictional
            demo data.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 border-t border-[#26282d] py-8 text-sm md:grid-cols-3">
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-3 text-sm font-semibold text-white">{column.heading}</h2>
              <ul className="space-y-2 text-ink-subtle">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col items-start justify-between gap-4 border-t border-[#26282d] pt-8 text-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-6">
            <a href={REPO} className="underline decoration-ink-subtle/40 underline-offset-4 hover:text-white">
              GitHub
            </a>
            <a href={`${REPO}/blob/master/docs/PRD.md`} className="underline decoration-ink-subtle/40 underline-offset-4 hover:text-white">
              PRD
            </a>
            <Link to="/privacy" className="underline decoration-ink-subtle/40 underline-offset-4 hover:text-white">
              Privacy
            </Link>
          </div>
          <div className="font-mono text-xs text-ink-subtle">© 2026 Venture Route. Deterministic evaluation registry.</div>
        </div>
      </div>
    </footer>
  );
}
