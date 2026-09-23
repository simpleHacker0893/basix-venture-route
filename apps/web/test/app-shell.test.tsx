/**
 * Seam: rendered screen through React Testing Library (Sprint 002 #23).
 * The app shell mounts with the wordmark and the route to the founder flow.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("app shell", () => {
  it("renders the wordmark and a way into the founder flow", () => {
    render(<App initialPath="/" />);

    expect(screen.getByRole("link", { name: "Venture Route" })).toHaveAttribute("href", "/");
    const ctas = screen.getAllByRole("link", { name: "Route my venture" });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/route");
  });

  it("renders the routing page at /route", () => {
    render(<App initialPath="/route" />);

    expect(screen.getByRole("heading", { level: 1, name: "Describe your MVP" })).toBeInTheDocument();
  });
});
