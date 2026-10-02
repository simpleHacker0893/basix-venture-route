/**
 * Selects the demo suite's ports, output dir and build dir in `e2e/clerk/env.ts` (8002/4176,
 * `test-results-demo`, `dist-demo`). `playwright.demo.config.ts` imports this module before the
 * harness, so the setting is in `process.env` before `env.ts` loads, and the workers and global
 * setup inherit it.
 */
process.env.E2E_CLERK_SUITE = "demo";

export {};
