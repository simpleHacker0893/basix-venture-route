import { Link } from "react-router";

/**
 * 64 px top navigation from the DESIGN.md block and pack prompt 2.1: wordmark, links
 * "How it works", "Evidence", "For builders", secondary "Sign in", primary "Route my venture".
 */
export function TopNav() {
  return (
    <header className="h-[var(--vr-nav-height)] border-b border-border bg-ground">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-full w-full max-w-[var(--vr-content-max)] items-center justify-between px-6"
      >
        <Link to="/" className="font-display text-xl font-semibold text-ink">
          Venture Route
        </Link>
        <div className="flex items-center gap-6 text-sm text-ink-2">
          <Link to="/#how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <Link to="/#evidence" className="hover:text-ink">
            Evidence
          </Link>
          <Link to="/#for-builders" className="hover:text-ink">
            For builders
          </Link>
          {/* Secondary button per the pack; Clerk sign-in arrives in Sprint 003. */}
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-card border border-border-strong bg-surface-strong px-4 font-medium text-ink"
          >
            Sign in
          </Link>
          <Link
            to="/route"
            className="inline-flex h-10 items-center rounded-card bg-accent-green px-4 font-medium text-white"
          >
            Route my venture
          </Link>
        </div>
      </nav>
    </header>
  );
}
