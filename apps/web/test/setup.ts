import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

// The side-effect import above adds the matcher types; registering the matchers on this
// vitest's `expect` as well keeps them working when pnpm resolves `jest-dom/vitest` against
// another vitest copy in the store (seen on a fresh Windows install).
expect.extend(matchers);

// jsdom does not implement scrolling; ScrollToHash (#79) calls both on every navigation.
window.scrollTo = () => undefined;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;

afterEach(() => {
  cleanup();
});
