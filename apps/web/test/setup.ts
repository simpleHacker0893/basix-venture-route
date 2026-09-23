import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom lays nothing out: the hash-scroll behaviour is observed through this stub.
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});
