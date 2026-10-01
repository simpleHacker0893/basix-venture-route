import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useAuthState } from "../auth/authContext";
import { ROLE_HOME } from "../auth/config";
import { FounderVoiceToggle } from "../chloe/ui/FounderVoiceToggle";
import { LogoMark } from "./Logo";

const HOME_LABEL = { founder: "Route my venture", builder: "Home", admin: "Review queue" } as const;

/**
 * The header, restyled for the refined UI (design/refined-ui) from the Stitch header
 * (design/stitch/batch-2/landing-page, D-36): sticky 64 px bar, the route mark and wordmark, section links, secondary "Sign in", primary "Route my venture".
 * Signed in, the secondary slot becomes the role home link plus "Sign out". Sprint 005a (#96,
 * spec #86 story 30) adds a public **Showcase** link, on desktop and in a mobile menu, signed in
 * or out. Sprint 005a (#102) adds the founder-wide "Voice: Chloe" switch for signed-in founders,
 * on desktop and in the mobile menu.
 */
/** Four-line hamburger that folds into a cross while the mobile menu is open. */
function MenuIcon({ open }: Readonly<{ open: boolean }>) {
  const line = "absolute left-0 h-[2px] w-5 rounded-full bg-ink transition-all duration-200 ease-out motion-reduce:transition-none";
  return (
    <span aria-hidden="true" className="relative block h-[17px] w-5">
      <span className={`${line} top-0 ${open ? "translate-y-2 opacity-0" : ""}`} />
      <span className={`${line} top-[5px] ${open ? "top-2 rotate-45" : ""}`} />
      <span className={`${line} top-[10px] ${open ? "top-2 -rotate-45" : ""}`} />
      <span className={`${line} top-[15px] ${open ? "-translate-y-2 opacity-0" : ""}`} />
    </span>
  );
}

export function TopNav() {
  const auth = useAuthState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = auth.isLoaded && auth.isSignedIn;
  const home = auth.role ? ROLE_HOME[auth.role] : "/choose-role";
  const homeLabel = auth.role ? HOME_LABEL[auth.role] : "Choose your role";
  const secondary =
    "rounded-lg border border-border-strong bg-surface-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-subtle";
  const mobileSecondary =
    "flex h-12 w-full items-center justify-center rounded-lg border border-border-strong bg-surface-strong text-[15px] font-medium text-ink";
  const close = () => setMobileOpen(false);

  // While the menu is open: Escape closes it, the page behind does not scroll, and widening
  // past the md breakpoint (where the desktop links return) closes it.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const wide = window.matchMedia?.("(min-width: 768px)");
    const onWide = () => {
      if (wide?.matches) setMobileOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    wide?.addEventListener?.("change", onWide);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      wide?.removeEventListener?.("change", onWide);
    };
  }, [mobileOpen]);

  const links: ReadonlyArray<[string, string]> = [
    ["/#how-it-works", "How it works"],
    ["/#evidence", "Evidence"],
    ["/#for-builders", "For builders"],
    ["/showcase", "Showcase"],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-ground/95 backdrop-blur-sm">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            onClick={close}
            className="flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-tight text-ink hover:opacity-90 sm:text-xl"
          >
            <LogoMark />
            Venture Route
          </Link>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex">
          {links.map(([to, label]) => (
            <Link key={to} to={to} className="transition-colors hover:text-accent-green">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <FounderVoiceToggle className="pb-0" />
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
              className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-accent-green-hover"
            >
              Route my venture
            </Link>
          </div>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="-mr-1.5 grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </nav>
      {mobileOpen ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-dark/25 animate-in fade-in-0 duration-200 md:hidden"
          />
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-ground px-4 pb-6 pt-2 shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:px-6 md:hidden"
          >
            <ul className="flex flex-col">
              {links.map(([to, label]) => (
                <li key={to} className="border-b border-border">
                  <Link
                    to={to}
                    onClick={close}
                    className="flex min-h-[52px] items-center justify-between text-[16px] font-medium text-ink transition-colors active:text-accent-green"
                  >
                    {label}
                    <ChevronRight aria-hidden="true" className="h-4 w-4 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-3">
              <FounderVoiceToggle className="pb-1 [&>div]:flex [&>div]:w-full [&>div>span:nth-child(2)]:flex-1" />
              {signedIn ? (
                <>
                  {auth.role === "founder" ? null : (
                    <Link to={home} className={mobileSecondary} onClick={close}>
                      {homeLabel}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      void auth.signOut();
                    }}
                    className={mobileSecondary}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/sign-in" className={mobileSecondary} onClick={close}>
                  Sign in
                </Link>
              )}
              <Link
                to="/route"
                className="flex h-12 w-full items-center justify-center rounded-lg bg-accent-green text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
                onClick={close}
              >
                Route my venture
              </Link>
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
