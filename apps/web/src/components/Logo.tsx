/**
 * The Venture Route mark: two nodes joined by a route, on a forest tile (refined UI,
 * design/refined-ui). Decorative only; the wordmark beside it carries the accessible name.
 */
export function LogoMark({ size = 28 }: Readonly<{ size?: number }>) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28" className="shrink-0">
      <rect width="28" height="28" rx="8" className="fill-accent-green" />
      <path d="M7 20C7 12 21 16 21 8" className="stroke-accent-on-dark" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="7" cy="20" r="3" fill="#f3f1ea" />
      <circle cx="21" cy="8" r="3" className="fill-accent-on-dark" />
    </svg>
  );
}
