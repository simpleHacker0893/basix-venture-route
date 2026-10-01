import { useEffect, useRef, useState } from "react";

type RollingNumberProps = Readonly<{
  value: number;
  /** Milliseconds before this number starts rolling, to stagger a row of stats. */
  delay?: number;
  className?: string;
}>;

const DIGITS = Array.from({ length: 20 }, (_, index) => index % 10);
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const ROW = 1.1; // em: one digit's slot
const FADE = "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)";
const digitGlyph = "block h-[1.1em] leading-[1.1em] before:content-[attr(data-d)]";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * An odometer: each digit spins one full turn and settles on its value the first time the number
 * scrolls into view, the ones column landing last. While the columns move their top and bottom
 * edges fade, then the fade lifts so the digits rest crisp. Reduced motion, or no
 * IntersectionObserver (tests, old browsers), shows the value at rest. Glyphs are drawn with CSS
 * `content`, so page text, copy and find-in-page see only the value, and assistive tech reads it
 * once from the sr-only span.
 */
export function RollingNumber({ value, delay = 0, className = "" }: RollingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = typeof IntersectionObserver === "undefined" || prefersReducedMotion();
  const [phase, setPhase] = useState<"idle" | "rolling" | "settled">(still ? "settled" : "idle");
  const digits = String(value).split("").map(Number);
  const total = delay + (digits.length - 1) * 60 + 1300 + (digits.length - 1) * 180;

  useEffect(() => {
    if (phase !== "idle" || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPhase("rolling");
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== "rolling") return;
    const timer = window.setTimeout(() => setPhase("settled"), total + 50);
    return () => window.clearTimeout(timer);
  }, [phase, total]);

  const moving = phase !== "idle";
  return (
    <span ref={ref} className={`inline-flex ${className}`}>
      <span className="sr-only">{value}</span>
      <span
        aria-hidden="true"
        className="inline-flex transition-opacity duration-500 ease-out"
        style={{ opacity: moving ? 1 : 0, transitionDelay: `${delay}ms` }}
      >
        {digits.map((digit, index) => {
          // Land on the second cycle so every column, zero included, turns once before it stops.
          const stop = 10 + digit;
          const duration = 1300 + index * 180;
          const start = delay + index * 60;
          const mask = phase === "rolling" ? FADE : "none";
          return (
            <span
              key={index}
              className="relative inline-block h-[1.1em] leading-[1.1em]"
              style={{ clipPath: "inset(0 -0.3em)", maskImage: mask, WebkitMaskImage: mask }}
            >
              {/* Sizer: the column is exactly as wide as the digit it lands on. */}
              <span data-d={digit} className={`invisible ${digitGlyph}`} />
              <span
                className="absolute inset-x-0 top-0 flex flex-col items-center will-change-transform"
                style={{
                  transform: `translateY(${moving ? -Math.round(stop * ROW * 100) / 100 : 0}em)`,
                  transition: phase === "rolling" ? `transform ${duration}ms ${EASE} ${start}ms` : "none",
                }}
              >
                {DIGITS.map((d, position) => (
                  <span key={position} data-d={d} className={digitGlyph} />
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
