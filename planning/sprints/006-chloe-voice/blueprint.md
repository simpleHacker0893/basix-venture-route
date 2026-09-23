# Sprint 006 — blueprint

## Files
```
apps/web/src/voice/provider.ts                  # VoiceProvider, VoiceErrorCode, VoiceError, ListenHandlers
apps/web/src/voice/webSpeechProvider.ts         # createWebSpeechProvider(win), PREFERRED_VOICES, pickVoice
apps/web/src/voice/fakeVoiceProvider.ts         # createFakeVoiceProvider(opts), installWindowHook (window.__chloeVoice, fake only)
apps/web/src/voice/selectProvider.ts            # VOICE_PROVIDER from VITE_VOICE_PROVIDER; createVoiceProvider(): VoiceProvider | null
apps/web/src/voice/VoiceSession.tsx             # VoiceSessionProvider + voiceReducer; useVoice()
apps/web/src/voice/voiceContext.ts              # VoiceContext, VoiceSessionValue (mirrors state/routingContext.ts)
apps/web/src/voice/env.d.ts                     # ImportMetaEnv.VITE_VOICE_PROVIDER

apps/web/src/chloe/engineHints.ts               # FORM_FALLBACK_HINT, ROUTE_MESSAGE, CLARIFICATION_PREFIX copies; isKeyless(response)
apps/web/src/chloe/script.ts                    # GREETING, QUESTIONS, questionFor, readBack, CONFIRM_*, speakRoute, OFFLINE_ASSISTANT, UNREACHABLE, validationSpoken, MIC_ERRORS, captions, spokenForm
apps/web/src/chloe/confirm.ts                   # YES_PHRASES, NO_PHRASES, matchConfirm, normalise
apps/web/src/chloe/useChloe.ts                  # conductor: reaction effect + submitTranscript
apps/web/src/chloe/ChloeProvider.tsx            # mounted in RoutePage; cancels speech on unmount
apps/web/src/chloe/ui/VoiceToggle.tsx           # role="switch" "Voice: Chloe"; greeting spoken in the click handler
apps/web/src/chloe/ui/MicButton.tsx             # push-to-talk (pointer + Space/Enter); data-testid="mic-button"
apps/web/src/chloe/ui/SpeakingIndicator.tsx     # role="status" "Chloe is speaking" + "Stop Chloe"
apps/web/src/chloe/ui/VoiceCaptions.tsx         # ConsentCaption, UnsupportedCaption, MicErrorLine

apps/web/src/state/routingReducer.ts            # edit: Turn.role |= "chloe"; action chloe-said
apps/web/src/state/routingContext.ts            # edit: noteChloe(text)
apps/web/src/state/RoutingProvider.tsx          # edit: noteChloe dispatches chloe-said; sendTurn unchanged
apps/web/src/features/intake/IntakePage.tsx     # edit: VoiceToggle in the header row; SpeakingIndicator after ChatThread
apps/web/src/features/intake/Composer.tsx       # edit: MicButton left of Send; interim overlay; captions
apps/web/src/features/intake/ChatThread.tsx     # edit: third branch <li data-testid="chloe-turn"> labelled "Chloe"
apps/web/src/features/route/RoutePage.tsx       # edit: wrap in <ChloeProvider>
apps/web/src/features/route/RouteResultPage.tsx # edit: SpeakingIndicator under route.summary
apps/web/src/App.tsx                            # edit: voice?: VoiceProvider | null prop → VoiceSessionProvider (undefined → createVoiceProvider())

apps/web/test/fakeEngine.tsx                    # edit: renderApp(path, fetchLike?, { voice? }); keylessClarificationFor(partial)
apps/web/test/chloe.test.tsx                    # RTL cases below
apps/web/e2e/chloe.spec.ts, apps/web/e2e/helpers.ts   # enableVoice, holdAndSay, spoken
apps/web/playwright.config.ts                   # edit: VITE_VOICE_PROVIDER=fake on the :4173 preview build
.env.example, docs/API.md, planning/sprints/006-chloe-voice/operator-checklist.md
```

## Inherited (read before slicing)
- **The conversation contract is frozen.** `ChatTurn` is `{ userMessage, currentBrief? }`; `ChatResponse` is `clarification | route | validation-error` (`packages/contracts/src/chat.ts`, `services/engine/app/models/chat.py`). The orchestrator (`services/engine/app/conversation/orchestrator.py`) returns every missing field at once in PRD §5.3 order, from fixed templates, and prefixes `FORM_FALLBACK_HINT` when the adapter is unavailable. `AnthropicAdapter` only extracts fields; it never writes questions.
- **`sendTurn`** (`apps/web/src/state/RoutingProvider.tsx`) dispatches `founder-said` only for a non-empty message, then posts. `sendTurn({ userMessage: "", currentBrief })` is therefore the "Find my route" post with no founder turn: Chloe's "yes" path reuses it unchanged.
- **A `clarification` never has empty `missingFields`** (the engine routes instead), so the read-back trigger is the client-side `missingFields(currentBrief)` from `apps/web/src/lib/brief.ts` being empty on the intake view.
- **Tests**: `test/fakeEngine.tsx` fakes only `fetch`; jsdom has no Web Speech API; Playwright Chromium defines it but never returns recognition results headless. Both seams use the fake provider.
- **Labels and formats**: `SKILL_LABELS`, `VERTICAL_LABELS`, `MODE_LABELS`, `FIELD_LABELS` in `lib/brief.ts`; `usd`, `dateRange`, `STATUS_LABEL` in `lib/format.ts`; `splitFieldMessages` in `lib/validationError.ts`. Chloe interpolates nothing else.
- **Design**: `design/stitch/batch-5/founder-intake-voice/` wins (D-36); the intake screen otherwise stays as converted in Sprint 002.

## Interfaces
```ts
// voice/provider.ts
type VoiceErrorCode = "no-speech" | "not-allowed" | "network" | "audio-capture" | "aborted" | "unknown";
type ListenHandlers = { onInterim(text: string): void; onFinal(text: string): void; onError(e: VoiceError): void; onEnd(): void };
interface VoiceProvider {
  kind: "web" | "fake"; supported: boolean;
  speak(text: string): Promise<void>;      // resolves on end or cancel
  cancelSpeech(): void;
  startListening(h: ListenHandlers): void;
  stopListening(): void;                   // release: flush pending finals, then onEnd
  abortListening(): void;                  // discard
}
// voice/VoiceSession.tsx — VoiceSessionValue
{ provider, supported, enabled, greeted, assistantOffline, status: "idle"|"listening"|"speaking", interim, nowSpeaking, lastError,
  enable(), disable(), say(text): Promise<void>, stopSpeaking(), pressMic(), releaseMic(): Promise<string>, markGreeted(), markAssistantOffline() }
// chloe/useChloe.ts — ChloeValue
{ ...voice, awaitingConfirmation, submitTranscript(text): Promise<"sent" | "held" | "dictation" | "empty"> }
```
Web provider: `lang = "en-GB"` (fallback `en-US`), `continuous = true`, `interimResults = true`; `SpeechRecognitionErrorEvent.error` mapped to `VoiceErrorCode`; voices resolved lazily with one `voiceschanged` listener; `pickVoice` prefers `/Google UK English Female/`, `/Microsoft (Sonia|Libby|Aria|Jenny)/`, then any `lang` starting `en`; `speak` splits at sentence boundaries into utterances of at most ~180 characters and resolves after the last `end` or `error`; `cancelSpeech` calls `speechSynthesis.cancel()` and resolves the pending promise.

Fake provider: `spoken: string[]`, `transcribe(text)` (emits `onInterim` then `onFinal` while listening), `fail(code)`, `finishSpeaking()`, `holdUtterances` option; `installWindowHook` sets `window.__chloeVoice = { spoken(), transcribe, fail, finishSpeaking }`.

## Conductor (`chloe/useChloe.ts`)
Refs `spokenForResponse`, `confirmedBriefKey`, `spokenUnreachable`; one effect over `[voice.enabled, state.lastResponse, state.view, state.currentBrief, state.unreachable]`. Every utterance is `voice.say(spokenForm(text))` and `noteChloe(text)`.

| Trigger (voice enabled) | Chloe does | Guard |
|---|---|---|
| `enable()` clicked | greeting inside the click handler, then evaluates the rows below for the current state | `greeted` once per session |
| new `clarification`, `isKeyless`, not yet `assistantOffline` | `OFFLINE_ASSISTANT`; `markAssistantOffline()`; no question | once per session |
| new `clarification`, otherwise | `questionFor(missingFields[0])`; skipped when `assistantOffline` | `spokenForResponse` |
| new `route` | `speakRoute(route)` lines | `spokenForResponse` |
| new `validation-error` | `validationSpoken(message)`; clear `awaitingConfirmation` | `spokenForResponse` |
| `view === "intake"`, `missingFields(currentBrief)` empty, `lastResponse?.type !== "route"` | `readBack(currentBrief)` then `CONFIRM_PROMPT`; `awaitingConfirmation = true` | `confirmedBriefKey = JSON.stringify(currentBrief)` |
| `unreachable` becomes non-null | `UNREACHABLE` | once per distinct message |
| user-driven `view-changed`, `request-started`, mic press | `stopSpeaking()` | — |
| `ChloeProvider` unmount | `stopSpeaking()`, `abortListening()` | — |

`submitTranscript(text)`: empty → `"empty"` and `MIC_ERRORS["no-speech"]`; `awaitingConfirmation` and `matchConfirm === "yes"` → `CONFIRM_YES_REPLY`, `sendTurn({ userMessage: "", currentBrief })`, `"sent"`; `matchConfirm === "no"` → `CONFIRM_NO_REPLY`, clear, `"held"`; `assistantOffline` → `"dictation"` (caller puts the text in the composer); otherwise `sendTurn({ userMessage: text, currentBrief })`, `"sent"`. No-op while `state.busy`.

`matchConfirm`: lowercase, strip punctuation, collapse spaces; match when the utterance equals a phrase or starts with `phrase + " "`, so "yes please" matches and "now" / "not" do not match "no".

## Spoken text (`chloe/script.ts`)
| Key | Text |
|---|---|
| `GREETING` | Hi, I'm Chloe, Venture Route's assistant. Hold the mic, tell me about your MVP, and let go when you're done. I'll ask for anything that's missing. |
| `QUESTIONS.title` | First, what are you building? One line is enough. |
| `QUESTIONS.vertical` | Which vertical is it for: health, agri, or education? |
| `QUESTIONS.requiredSkills` | Which skills do you need? You can pick from {SKILL_LABELS values, comma-joined with "and"}. |
| `QUESTIONS.maximumTeamSize` | How many builders at most? Anywhere from one to five. |
| `QUESTIONS.availabilityStart` | When should the engagement start? A date is perfect. |
| `QUESTIONS.availabilityEnd` | And when should it end? |
| `QUESTIONS.deliveryMode` | How will the team work: remote, hybrid, or on-site? |
| `QUESTIONS.location` | Which town or city is the on-site work in? |
| `QUESTIONS.dailyBudget` | What's your budget in US dollars per day? |
| `QUESTIONS.preferReusableIp` | Should I look for reusable IP you could build on? Yes or no. |
| `readBack(brief)` | Here's your brief so far. {title}, in {VERTICAL_LABELS[vertical]}. Skills: {SKILL_LABELS joined}. Up to {n} builders. {dateRange(start, end)}. {MODE_LABELS[mode]}{ in {location} when on-site}. Budget {usd(dailyBudget)}. Reusable IP {preferred \| not needed}. |
| `CONFIRM_PROMPT` | Shall I find your route? Say yes or go ahead, or say no if you'd like to change something first. |
| `CONFIRM_YES_REPLY` / `CONFIRM_NO_REPLY` | Finding your route. / No problem. Tell me what to change, or edit it in the brief panel. |
| `speakRoute(route)` | Your route is {STATUS_LABEL[status]}. · `route.summary` verbatim · per gap: There's a {category} gap: {statement} You could {nextActions joined "; or "}. · The full route is on screen, with the evidence behind each choice. |
| `OFFLINE_ASSISTANT` | Heads up: the assistant behind me is offline right now, so I can't understand free speech. The mic still works as dictation, what you say lands in the reply box for you to edit, or use the form instead. |
| `UNREACHABLE` | I can't reach the routing engine right now. Use the form instead, or try again in a moment. |
| `validationSpoken(msg)` | The engine found a problem with the brief: {FIELD_LABELS[field]}: {text}; … Fix it in the brief panel or the form. |
| `MIC_ERRORS` | no-speech: I didn't catch that. Hold the mic and try again. · not-allowed: Microphone access is blocked. Allow it in your browser's site settings. · network: Speech recognition needs a network connection. · audio-capture: I can't find a microphone. · aborted/unknown: Let's try that again. |
| `UNSUPPORTED_CAPTION` | Voice needs Chrome or Edge. |
| `CONSENT_CAPTION` | Voice uses your browser's speech service: Chrome sends your audio to Google for transcription. |

`spokenForm(text)`: `" / day"` → `" a day"`, `" – "` → `" to "`, `"UI/UX"` → `"U I U X"`, `"AI / MeTTa"` → `"A I, MeTTa"`. Display text (stored in the `chloe` turn) is unchanged.

## Steps
1. **Device layer ticket** (`voice/*`, `App.tsx` prop, `.env.example`): provider interface, web and fake providers, selection, session context. RTL: the fake provider records `say` and returns transcripts; the web provider reports `supported = false` under jsdom.
2. **Store and thread ticket**: `chloe` turn role, `chloe-said`, `noteChloe`, `ChatThread` branch. RTL: a `chloe-said` renders a `chloe-turn` and never a `founder-turn`.
3. **Script ticket** (`chloe/script.ts`, `confirm.ts`, `engineHints.ts`): pure functions; RTL through rendered screens only (D-19), so these are exercised by the conductor tests below.
4. **Conductor + UI ticket**: `useChloe`, `ChloeProvider`, `VoiceToggle`, `MicButton`, `SpeakingIndicator`, captions, `Composer` and `IntakePage` edits, converted from the batch-5 export. RTL cases: greeting once; first missing field only; read-back and yes posts `{ userMessage: "", currentBrief }`; not yet holds; route speaks status, summary, gaps; keyless once then dictation; unsupported hides the mic; offline and `off` hide the toggle; unreachable line; validation-error line; mic errors.
5. **Playwright ticket**: `playwright.config.ts` sets `VITE_VOICE_PROVIDER=fake` on the `:4173` preview build; `e2e/chloe.spec.ts` drives `window.__chloeVoice`; voice path route deep-equals the form path's `POST /api/route` body; toggle absent on `:4174`; "Stop Chloe" with `holdUtterances`.
6. **Docs ticket**: `docs/API.md` sentence, `operator-checklist.md` manual Chrome check with the real key, `STATE.md`.
