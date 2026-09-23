# Sprint 006 — Operator checklist (human tasks, keys, manual voice check)

The Builder never asks for a key in chat (D-26). No new key is needed for this sprint: the browser's own speech service does the transcription and the voice.

## Before Sprint 006 P1

| # | Task | How | Done when |
|---|---|---|---|
| 1 | Set the sprint window (Q-13) | Edit `requirements.md` and `planning/TIMELINE.md` | Dates in both files |
| 2 | Decide Q-14 (extra yes/no phrases) | Reply in the Architect session; the answer lands in `requirements.md` item 5 | Q-14 closed |
| 3 | Merge the Sprint 005 PR | GitHub merge button after the Architect review | PR shows Merged |
| 4 | Confirm `design/stitch/batch-5/founder-intake-voice/` is committed | `git ls-files design/stitch/batch-5` | `index.html` and the screenshot listed |

## Manual voice check (Should line, after the Builder's PR is open)

Chrome only; the Web Speech API is not available in Firefox or Safari.

1. Put the real `ANTHROPIC_API_KEY` in the repo-root `.env` (`LLM_PROVIDER=anthropic`). Start the engine (`uv run uvicorn app.main:app --port 8000` in `services/engine`) and the web app (`pnpm -F web dev`).
2. Open `http://localhost:5173/route` in Chrome. Allow the microphone when asked.
3. Switch on "Voice: Chloe". You should hear the greeting.
4. Hold the mic, say "I want to build a maternal health triage pilot for clinics in Nakuru. I need Python, AI with MeTTa and a UI designer, hybrid, this month, about 400 dollars a day.", release.
5. Expected: the transcript appears as your turn; the brief panel fills; Chloe asks one question (team size or dates). Answer by voice until every chip is filled.
6. Expected: Chloe reads the brief back and asks "Shall I find your route?". Say "yes". The route screen renders and Chloe reads the status and summary.
7. Paste what you heard and saw, and any mismatch, into the PR as the Should-line evidence.
