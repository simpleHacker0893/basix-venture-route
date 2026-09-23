# Sprint 006 — acceptance

Every RTL line runs with the fake voice provider injected through `renderApp(path, fetch, { voice })`. Every Playwright line runs against `vite preview` built with `VITE_VOICE_PROVIDER=fake`, the engine on `LLM_PROVIDER=null` (D-33). The Web Speech provider itself is covered by the manual Should line only (R-11).

## Must
- [ ] Contract and engine unchanged: `git diff --stat origin/master -- packages/contracts services/engine/app/models services/engine/app/conversation services/engine/seed` prints nothing.
- [ ] RTL (`pnpm -F web test -- test/chloe.test.tsx`): enabling "Voice: Chloe" speaks the greeting exactly once per session (disable and re-enable does not repeat it), and one `chloe-turn` renders.
- [ ] RTL: after a vague message, the assistant turn shows the engine's full clarification list ("To route this brief I still need:" and every required field) while the fake provider recorded exactly one new spoken line, the `title` question.
- [ ] RTL: Health pilot loaded → "Back to chat" → voice on → the spoken read-back contains `USD 400 / day` and "Shall I find your route?"; holding the mic and transcribing "yes" posts `{ "userMessage": "", "currentBrief": <the seed brief> }` (asserted on the captured request body), adds no `founder-turn`, and the `Feasible` badge renders; transcribing "not yet" instead posts nothing to `/api/conversation`.
- [ ] RTL: Constrained brief through the yes path → the spoken lines include "Your route is Partial.", the route `summary`, the `route-gap` statement and both D-29 next-action texts in order.
- [ ] RTL: a clarification whose message starts with the form-fallback hint is announced once ("the assistant behind me is offline"); a second keyless clarification adds no spoken line; a transcribed "hello" afterwards lands in the "Reply to assistant" textarea and no request is sent.
- [ ] RTL: with `createWebSpeechProvider()` under jsdom (`supported = false`) the switch is disabled, "Voice needs Chrome or Edge." renders and no `mic-button` exists; with the offline source, or `voice: null`, the switch is absent.
- [ ] RTL: a 503 on `/api/scenarios` shows the existing API banner and the fake provider recorded "I can't reach the routing engine" once; a `validation-error` response `availabilityEnd: …` is spoken with the `End` label; a `no-speech` failure on release renders the mic error line and sends nothing.
- [ ] Playwright (`pnpm -F web e2e -- e2e/chloe.spec.ts`): the Agri marketplace routed by voice ("go ahead" through `window.__chloeVoice`) yields a `/api/conversation` response whose `route` deep-equals the form path's `POST /api/route` body, with the same builder ids in the same order; `window.__chloeVoice.spoken()` starts with the greeting.
- [ ] Playwright: the offline preview (`:4174/route`) has no "Voice: Chloe" switch.
- [ ] `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -F web e2e` and the engine suite are green locally and in CI (link the run in the report). `.env.example` documents `VITE_VOICE_PROVIDER`. `docs/API.md` carries the voice-client sentence. `planning/STATE.md` is updated.

## Should
- [ ] Manual, Chrome, real `ANTHROPIC_API_KEY` in `.env` (D-26): on `http://localhost:5173/route`, allow the microphone, enable voice, hold-and-speak the Health pilot sentence; the transcript sends, the brief panel fills, and Chloe's reply is audible in an English voice. Record the steps and outcome in `operator-checklist.md`.
- [ ] Playwright: the consent caption is present (`getByText(/sends your audio to Google/)`); with `?voiceHold=1` on the fake build, "Chloe is speaking" is visible and "Stop Chloe" hides it and empties the queue.
- [ ] `web-design-guidelines` audit on the intake voice state at 1440 and 1024 px; findings fixed or listed in the report.
