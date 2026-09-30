# Sprint 006 — Chloe voice intake

**Window:** merged into Sprint 005a, Fri 25 Sep 08:00 → Sun 27 Sep 20:00 EAT, gate G5a (D-51). **Branch:** `sprint/005a-showcase`, PR "Sprint 005a: Showcase and Chloe", spec #86. **Depends on:** Sprint 004 merged (done); a real `ANTHROPIC_API_KEY` in `.env` for the manual voice check (D-26). Stitch export under `design/stitch/batch-5/founder-intake-voice/` (D-36 applies).

**Additions in 005a (D-51):** the "Voice: Chloe" switch moves to the founder header (remembered in `sessionStorage`) and `VoiceSessionProvider` mounts above the founder routes; Chloe also reads aloud on `/dashboard` (counts and next upcoming booking) and `/bookings/:id` (state and latest proposal in Africa/Nairobi time), templated only from those API responses, with no voice commands. The "engine and contract unchanged" rule means the conversation contract only (see acceptance).

## Goal
A founder holds a microphone on the intake screen, describes the MVP, and is walked by Chloe, one spoken question at a time, to a complete brief and a spoken route. The typed chat path and the form path are untouched and byte-identical in outcome (AGENTS.md rule 7). Chloe is a voice skin over `POST /api/conversation`; the engine, the contract and the MeTTa rules do not change (D-38).

## User stories
- As a founder, I can turn on "Voice: Chloe", hold the mic, say what I am building, and hear Chloe ask for the next missing field.
- As a founder, when every field is filled, I hear my brief read back and can say "yes" to find my route, or "not yet" to change something.
- As a founder, when the route arrives I hear its status, the summary, and each gap with its next actions, then read the details on screen.
- As a judge, I can see that Chloe only restates what the engine returned: the same clarification list and the same route are on screen, and the "MeTTa rules decide" caption stays.

## In scope
1. **Voice device layer** `apps/web/src/voice/`: a `VoiceProvider` interface (`speak`, `cancelSpeech`, `startListening`, `stopListening`, `abortListening`; handlers `onInterim`, `onFinal`, `onError`, `onEnd`; error codes `no-speech | not-allowed | network | audio-capture | aborted | unknown`), `webSpeechProvider` over the browser `SpeechRecognition` and `speechSynthesis` APIs, `fakeVoiceProvider` (records spoken text, injects transcripts, exposes `window.__chloeVoice` only on the fake), `selectProvider` by `VITE_VOICE_PROVIDER` (`web` default, `fake`, `off`; `null` whenever `VITE_OFFLINE_DEMO=1`), and a `VoiceSessionProvider` context holding `enabled`, `status` (`idle | listening | speaking`), `interim`, `lastError`, `greeted`, `assistantOffline`, an utterance queue, and `pressMic` / `releaseMic` / `say` / `stopSpeaking`.
2. **Chloe persona layer** `apps/web/src/chloe/`: `script.ts` (every English line, templated only from `ChatResponse` and `VentureRoute`, reusing the labels in `lib/brief.ts` and `usd` / `dateRange` in `lib/format.ts`), `confirm.ts` (yes/no phrase matcher), `engineHints.ts` (client copies of the orchestrator's `FORM_FALLBACK_HINT`, `ROUTE_MESSAGE`, `CLARIFICATION_PREFIX` with a comment pointing at `services/engine/app/conversation/orchestrator.py`; `isKeyless(response)`), the `useChloe` conductor, `ChloeProvider` mounted in `RoutePage`, and the UI pieces `VoiceToggle`, `MicButton` (push-to-talk by pointer and keyboard), `SpeakingIndicator` with "Stop Chloe", `ConsentCaption`, `UnsupportedCaption`, `MicErrorLine`.
3. **Store**: `Turn.role` gains `"chloe"` and the reducer gains one action `chloe-said`; `ChatThread` renders a `chloe-turn`. Nothing else changes in `routingReducer.ts`. Chloe never calls the API source; every request goes through the existing `sendTurn` in `state/RoutingProvider.tsx`.
4. **Composer**: while the mic is held, the interim transcript streams into the textarea; on release the final transcript is sent through the same `sendTurn({ userMessage, currentBrief })` shape that `IntakePage.onSend` uses. When the engine is keyless (item 6) the transcript stays in the textarea and nothing is sent.
5. **Read-back and confirm**: when `view === "intake"`, the client-side `missingFields(currentBrief)` (`lib/brief.ts`) is empty and the last response is not a route, Chloe reads the brief back and asks "Shall I find your route?". A yes phrase (`yes`, `go ahead`, `do it`, plus any Q-14 additions) triggers `sendTurn({ userMessage: "", currentBrief })`, exactly what the "Find my route" button posts; a no phrase (`no`, `wait`, `not yet`) holds. Asked once per distinct brief. The button stays.
6. **Keyless engine**: when a clarification message starts with the form-fallback hint (the engine is on `NullAdapter`), Chloe says once that the assistant is offline and that the mic works as dictation, and points to "Use the form instead". Later clarifications are not read out. The read-back/yes path still routes, because routing a complete brief needs no model.
7. **Screen**: the intake voice state from `design/stitch/batch-5/founder-intake-voice/` (voice toggle in the header row, mic left of Send with "Hold to talk", speaking indicator with "Stop Chloe", Chloe turn style, the two captions).
8. **Tests at the seams** (D-19): `apps/web/test/chloe.test.tsx` (RTL; the fake provider injected through `renderApp(path, fetch, { voice })`) and `apps/web/e2e/chloe.spec.ts` (Playwright against the `:4173` preview built with `VITE_VOICE_PROVIDER=fake`; helpers `enableVoice`, `holdAndSay`, `spoken` in `e2e/helpers.ts`).
9. **Docs**: `VITE_VOICE_PROVIDER` in `.env.example`; one sentence under `POST /api/conversation` in `docs/API.md` ("the browser voice layer is a client of this endpoint with no extra fields"); a manual Chrome check in `operator-checklist.md`.

## Out of scope
- Investors, an investor brief, or any new role.
- Cloud speech-to-text or text-to-speech; a realtime voice API; any new key.
- Open mic, voice-activity detection, barge-in.
- An engine persona flag or any change to `packages/contracts`, `services/engine/app/models`, `services/engine/app/conversation` or the MeTTa rules.
- Languages other than English.

## Business rules
- Chloe speaks only text templated from the `ChatResponse` and `VentureRoute` the engine returned: the first entry of `missingFields`, the read-back of `currentBrief`, `route.summary` verbatim, each gap's `statement` and `nextActions` in order. She never names a builder the route does not carry, never invents evidence, never names a rule that did not fire, never sets or alters the status (AGENTS.md rules 1–3, PRD §5.7).
- One question per turn: the first field in the server's `missingFields` order (PRD §5.3 order; `location` last when on-site). The thread still shows the engine's full clarification list as the assistant turn.
- Speech starts only after a user gesture: the greeting is spoken inside the toggle's click handler. Greeting once per session.
- Push-to-talk only. Pressing the mic cancels any speech in progress. The mic is disabled while `busy`, exactly like Send.
- Wording on screen is the display text; `spokenForm()` only rewrites `" / day"` to `" a day"`, `" – "` to `" to "`, and `"UI/UX"` to `"U I U X"` before speaking.
- The "Routes are computed by MeTTa rules over demo records. The assistant only translates your words." caption stays on the intake screen in every state.
- Every Chloe line is appended to the thread as a `chloe` turn so the transcript is inspectable; `chloe` turns are display-only and are never posted or exported (`handoffText` reads brief and route only).

## Edge cases
- Empty transcript on release (`no-speech`): Chloe says "I didn't catch that. Hold the mic and try again."; nothing is sent.
- `not-allowed`, `network`, `audio-capture`: shown in the mic error line and spoken once; the mic stays visible; no automatic retry; the caption points to "Use the form instead".
- Interim results are never sent; only accumulated final results form the transcript. Release resolves on the recogniser's `end` event, capped at 3 s.
- Unsupported browser (`SpeechRecognition` or `speechSynthesis` absent): the toggle is disabled with the caption "Voice needs Chrome or Edge." and no mic renders.
- Offline demo (`VITE_OFFLINE_DEMO=1`) or `VITE_VOICE_PROVIDER=off`: no voice UI at all.
- `validation-error` (422 or in-band): Chloe speaks the field messages ("The engine found a problem with the brief: End: …"); the confirmation state is cleared until the brief changes.
- Engine unreachable: the existing banner plus one spoken line "I can't reach the routing engine right now. Use the form instead, or try again in a moment."
- Navigation or a user-driven view change (Change brief, Back to chat, Load scenario, `?mode=form`), `request-started`, disabling voice, or leaving `/route` cancels speech and aborts listening. The view change that arrives with a route response does not, because that is when the route is spoken.
- Chrome drops long utterances: text is chunked at sentence boundaries (about 180 characters); "Stop Chloe" cancels the whole queue. Voices load asynchronously: the preferred English voice is re-resolved on `voiceschanged`; the first utterance may use the default voice.
