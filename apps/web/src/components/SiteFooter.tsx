/** Section 6 of the landing pack: dark footer with the wordmark, the demo-data line and links. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-dark py-10 text-white/80">
      <div className="mx-auto flex w-full max-w-[var(--vr-content-max)] flex-col gap-6 px-6 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <span className="font-display text-xl font-semibold text-white">Venture Route</span>
          <p className="text-sm">
            Built for the BASIX hackathon, SingularityNET MeTTa track. All records are fictional
            demo data.
          </p>
        </div>
        <nav aria-label="Footer" className="flex gap-6 text-sm">
          <a href="https://github.com/simpleHacker0893/basix-venture-route" className="hover:text-white">
            GitHub
          </a>
          <a href="https://github.com/simpleHacker0893/basix-venture-route/blob/master/docs/PRD.md" className="hover:text-white">
            PRD
          </a>
          <a href="https://github.com/simpleHacker0893/basix-venture-route#privacy" className="hover:text-white">
            Privacy
          </a>
        </nav>
      </div>
    </footer>
  );
}
