import { Link } from "react-router";

/** 64 px top navigation from the DESIGN.md block: wordmark left, text links and one button right. */
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
          <Link to="/" className="hover:text-ink">
            How it works
          </Link>
          <Link to="/" className="hover:text-ink">
            For builders
          </Link>
          {/* Secondary button per the pack; Clerk sign-in arrives in Sprint 003. */}
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-card border border-border-strong bg-surface-strong px-4 font-medium text-ink"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
