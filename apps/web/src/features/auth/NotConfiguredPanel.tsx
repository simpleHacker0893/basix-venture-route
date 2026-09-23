import { Link } from "react-router";

/** No-key mode (D-26): the marketplace screens explain the missing key; routing keeps working. */
export function NotConfiguredPanel() {
  return (
    <section
      aria-labelledby="not-configured-heading"
      className="rounded-card border border-dashed border-border-strong bg-surface/70 p-6 text-left"
    >
      <h2 id="not-configured-heading" className="font-display text-xl font-semibold text-ink">
        Sign-in is not configured
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Accounts need a Clerk publishable key. Put it in the git-ignored <code className="font-mono">.env</code> as{" "}
        <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> and restart the web app. Routing works
        without an account.
      </p>
      <Link
        to="/route"
        className="mt-4 inline-flex items-center rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green-hover"
      >
        Route my venture
      </Link>
    </section>
  );
}
