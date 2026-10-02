# Demo recording

Playwright drives the real app scene by scene and records each scene as its own clip (#143, #145, #146). Local only, never in CI (D-33).

## Run

From a clean local stack (repo root), then from `apps/web`:

```sh
docker compose down -v && docker compose up -d db seed   # fresh Postgres + migrations + Showcase demo seed
# Another stack already on 5432? Set POSTGRES_PORT (e.g. 5433) for both commands: compose and the harness read it.
pnpm --filter @venture-route/contracts build
cd apps/web && pnpm demo:record   # playwright test -c playwright.demo.config.ts
```

It needs the same repo-root `.env` as the Clerk suite (`pnpm e2e:clerk`): a development-instance `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `CLERK_JWKS_URL`. The engine also takes `LLM_PROVIDER` and its key from that `.env`. Never run the Clerk suite and the demo at the same time: both reset the same compose `db` (`scripts/e2e_reset.py`).

A take counts only after the demo passes twice in a row from a clean `docker compose up` (spec #143 story 25).

## What it does

- Reuses the Clerk harness (`e2e/clerk/harness.ts`): fresh `+clerk_test` users per run, the engine on the compose `db` (port 8002) and a production build served by `vite preview` (port 4176). The build sets `VITE_VOICE_PROVIDER=fake`, so Chloe is driven through the fake provider's window hook (`window.__chloeVoice`).
- Records at 1920×1080 with a 250 ms slow-mo, one worker, no retries: a flaky take fails.
- Shows each scene's caption in an overlay injected by the harness (`captions.ts`). No app code changes for captions. Chloe's replies and the founder's spoken words are shown the same way, because the video has no audio.
- Writes one clip per scene to `apps/web/demo-output/clips/<clip>.webm` (git-ignored), named by the script's stable clip name (`F1-signup`, `F2-chloe-brief`, …).

## The recording model (`fixtures.ts`)

- **One browser context and one page per role.** A scene is recorded as `visitor`, `founder`, `builder` or `admin`. The role's context and page open on its first scene and stay open for the run, so consecutive scenes of a role continue where the last one stopped. Chloe's conversation and the routed brief live only in the page's memory, so F2–F8 need this.
- **The Clerk session is persisted per role.** After each passing scene, the role's `storageState` is saved to `test-results-demo/roles/<role>.json`. If a role's page has to be opened again (a new worker), its context starts from that file and the role is already signed in: nobody signs in again on camera. `visitor` is never saved.
- **One clip per scene, from that scene's page.** Each scene records a screencast of its role's page (`page.screencast`, 1920×1080) into the test's output folder.
- **Every frame is checked, not just the file header.** A page has one shared screencast, and its first client sets the frame size. The config therefore keeps traces on failure but without trace screenshots: otherwise Playwright's default 800 px frames would be padded into a 1920×1080 canvas. The fixture fails a scene if any captured frame is not 1920×1080.
- **A failed scene never writes its clip.** The clip is copied to `demo-output/clips/` only when the scene's body passed and the clip is 1920×1080. A failed or timed-out scene leaves any earlier clip of that scene untouched, and does not save the role's session.
- **Story order.** Spec files are numbered (`1-hook`, `2-founder`, …) because the runner takes them alphabetically with one worker. That is also the order the data needs: the founder publishes before the builder bids. Each journey file is serial, so a failed scene skips the rest of it.

Sign-up is shown, not stubbed: `signUp.ts` goes through "Who are you?" and the real Clerk sign-up form with the run's fresh address `vr-e2e-<run>-<role>-signup+clerk_test@example.com` and code 424242. The global teardown deletes those accounts with the harness users.

## Adding a scene

Add the ID, clip name and caption to `scenes.ts` (the scene table in `docs/demo/SCRIPT.md` is the source), then:

```ts
import { expect, hold, scene } from "./fixtures";

scene("B1", "builder", async (page) => {
  // assert what the viewer sees
  await hold(page, 3_000);
});
```

Use `showCaption(page, text)` from `captions.ts` to change the caption mid-scene.
