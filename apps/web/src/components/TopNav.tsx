import { useState } from "react";
import { Link } from "react-router";

import { useAuthState } from "../auth/authContext";
import { ROLE_HOME } from "../auth/config";

const HOME_LABEL = { founder: "Route my venture", builder: "Your profile", admin: "Confirmation queue" } as const;

/**
 * The Stitch header (design/stitch/batch-2/landing-page, D-36): sticky 64 px bar, wordmark with
 * the "BASIX Edition" badge, section links, secondary "Sign in", primary "Route my venture".
 * Signed in, the secondary slot becomes the role home link plus "Sign out". Sprint 005a (#96,
 * spec #86 story 30) adds a public **Showcase** link, on desktop and in a mobile menu, signed in
 * or out.
 */
export function TopNav() {
  const auth = useAuthState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = auth.isLoaded && auth.isSignedIn;
  const home = auth.role ? ROLE_HOME[auth.role] : "/choose-role";
  const homeLabel = auth.role ? HOME_LABEL[auth.role] : "Choose your role";
  const secondary =
    "rounded-md border border-[#2a2825] px-4 py-2 text-sm font-medium text-[#2a2825] transition-colors hover:bg-black/5";
  const sectionLinks = (
    <>
      <Link to="/#how-it-works" className="transition-colors hover:text-accent-green" onClick={() => setMobileOpen(false)}>
        How it works
      </Link>
      <Link to="/#evidence" className="transition-colors hover:text-accent-green" onClick={() => setMobileOpen(false)}>
        Evidence
      </Link>
      <Link to="/#for-builders" className="transition-colors hover:text-accent-green" onClick={() => setMobileOpen(false)}>
        For builders
      </Link>
      <Link to="/showcase" className="transition-colors hover:text-accent-green" onClick={() => setMobileOpen(false)}>
        Showcase
      </Link>
    </>
  );
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-ground/95 backdrop-blur-sm">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6"
      >
        <div className="flex items-center gap-3">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-ink hover:opacity-90">
            Venture Route
          </Link>
          <span className="rounded border border-ink-subtle/30 bg-dark/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            BASIX Edition
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-ink md:flex">{sectionLinks}</div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            {signedIn ? (
              <>
                {auth.role === "founder" ? null : (
                  <Link to={home} className={secondary}>
                    {homeLabel}
                  </Link>
                )}
                <button type="button" onClick={() => void auth.signOut()} className={secondary}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/sign-in" className={secondary}>
                Sign in
              </Link>
            )}
            <Link
              to="/route"
              className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-green-hover"
            >
              Route my venture
            </Link>
          </div>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="rounded-md border border-[#2a2825] px-3 py-2 text-sm font-medium text-[#2a2825] md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            Menu
          </button>
        </div>
      </nav>
      {mobileOpen ? (
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-border px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4 text-sm font-medium text-ink">{sectionLinks}</div>
          <div className="mt-4 flex flex-col gap-3">
            {signedIn ? (
              <>
                {auth.role === "founder" ? null : (
                  <Link to={home} className={secondary} onClick={() => setMobileOpen(false)}>
                    {homeLabel}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void auth.signOut();
                  }}
                  className={secondary}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/sign-in" className={secondary} onClick={() => setMobileOpen(false)}>
                Sign in
              </Link>
            )}
            <Link
              to="/route"
              className="rounded-md bg-accent-green px-4 py-2 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-green-hover"
              onClick={() => setMobileOpen(false)}
            >
              Route my venture
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
