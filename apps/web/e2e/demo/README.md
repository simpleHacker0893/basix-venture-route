# Demo recording

Playwright drives the real app scene by scene and records each scene as its own clip (#143, #145). Local only, never in CI (D-33).

## Run

From a clean local stack (repo root), then from `apps/web`:

```sh
docker compose up -d db seed      # Postgres + migrations + Showcase demo seed
pnpm --filter @venture-route/contracts build
cd apps/web && pnpm demo:record   # playwright test -c playwright.demo.config.ts
```

It needs the same repo-root `.env` as the Clerk suite (`pnpm e2e:clerk`): a development-instance `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `CLERK_JWKS_URL`. The engine also takes `LLM_PROVIDER` and its key from that `.env`.

## What it does

- Reuses the Clerk harness (`e2e/clerk/harness.ts`): fresh `+clerk_test` users per run, the engine on the compose `db` (port 8002) and a production build served by `vite preview` (port 4176). The build sets `VITE_VOICE_PROVIDER=fake`, so Chloe is driven through the fake provider's window hook.
- Records at 1920×1080 with a 250 ms slow-mo, one worker, no retries: a flaky take fails.
- Shows each scene's caption in an overlay injected by the harness (`captions.ts`). No app code changes for captions.
- Writes one clip per scene to `apps/web/demo-output/clips/<scene-id>.webm` (git-ignored) and fails the scene if the clip is not 1920×1080.

## Adding a scene

Add the ID and caption to `scenes.ts` (the scene table in the video script is the source), then:

```ts
import { expect, hold, scene } from "./fixtures";

scene("F1", async (page) => {
  await page.goto("/sign-up");
  // assert what the viewer sees
  await hold(page, 3_000);
});
```

Use `showCaption(page, text)` from `captions.ts` to change the caption mid-scene.
