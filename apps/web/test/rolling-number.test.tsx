/**
 * Seam: the hero's odometer numbers (src/components/RollingNumber.tsx). The value is read once,
 * the spinning columns add no text, and without IntersectionObserver the number is at rest.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RollingNumber } from "../src/components/RollingNumber";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RollingNumber", () => {
  it("exposes the value exactly once as text and hides the digit columns from assistive tech", () => {
    const { container } = render(<RollingNumber value={181} />);

    expect(screen.getByText("181")).toBeInTheDocument();
    expect(container.textContent).toBe("181");
    const columns = container.querySelector('[aria-hidden="true"]');
    expect(columns).not.toBeNull();
    // Three columns, each a sizer plus a strip of twenty glyphs drawn with CSS content.
    expect(columns!.querySelectorAll("[data-d]")).toHaveLength(3 * (1 + 20));
  });

  it("rests on the value with no transition when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<RollingNumber value={7} />);

    const columns = container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    expect(columns.style.opacity).toBe("1");
    const strip = columns.querySelector<HTMLElement>(".will-change-transform")!;
    expect(strip.style.transform).toBe("translateY(-18.7em)");
    expect(strip.style.transition).toBe("none");
  });
});
