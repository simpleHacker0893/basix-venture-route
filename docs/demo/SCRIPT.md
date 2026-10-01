# Demo video: plan and script

The plan and script for the Venture Route demo video (spec #143, ticket #144). Every later demo ticket follows it: the Playwright demo harness (#145), the scene recordings (#146–#148), the render step and `SUBMISSION.md`.

- **Length:** 175 s planned, inside the 180 s limit (see [Timing](#timing)).
- **Recording:** the local stack from a clean `docker compose up`, on the existing Clerk harness, with `+clerk_test` accounts, 1920×1080 video and caption overlays added by the harness. The Operator records the voiceover over the finished cut.
- **One story:** a founder briefs Chloe and gets a route, a builder gets verified, and the two meet through a bid and an interview booking. The video closes on the public Showcase.

Scene IDs (`H1`, `F1`–`F8`, `B1`–`B5`, `A1`, `C1`–`C3`, `X1`) and clip names are **stable**. The harness, the render step and any re-recording use them verbatim.

## The brief and skill for the video

**Brief:** Health pilot (`brief-health-01`, chip "Load scenario: Health pilot"). **Builder skill:** Python (`python`). The builder ends up **"Eligible · Python"** on the founder's published request.

### Why this brief

| Need | Health pilot + Python | Agri marketplace |
|---|---|---|
| A fresh builder with one confirmed credential sees "Eligible · <skill>" on the published request | Proven by `apps/web/e2e/clerk/sprint4-health-request.spec.ts` with Python: modes Remote and Hybrid, availability 2026-09-22 → 2026-10-20, one confirmed `python` credential, verdict "Eligible · Python" | No Clerk spec proves an Agri verdict. (`requests.spec.ts` proves "Eligible · Mobile" on the Constrained brief, which is Partial.) |
| Chloe's fake voice path can produce it | Yes, by the same clicks `chloe.spec.ts` uses (see below) | Proven by `apps/web/e2e/chloe.spec.ts` |
| MeTTa story on screen | `reuse-fit` (`asset-afya-triage`), four-hop `partner-fit` (`amani-health`), and the budget-change moment already proven on this brief in `apps/web/e2e/scenarios.spec.ts` | `reuse-fit` and `partner-fit` too, but no proven change-a-constraint moment |

**Chloe's fake path does not depend on the brief.** The demo engine runs with `LLM_PROVIDER=null`. Its `NullAdapter.extract_brief` extracts nothing, so on the deterministic path no brief can be dictated in free speech, Health or Agri. The only voice step that is deterministic is the one `chloe.spec.ts` drives:

1. Load a scenario chip.
2. Click "Back to chat". Chloe reads the brief back and asks "Shall I find your route?".
3. `tapAndSay(page, "go ahead")`. "go ahead" is a yes phrase in `chloe/confirm.ts`, so the brief goes to `POST /api/conversation`.

The chip comes from the shared `ScenarioChips` component, so the same clicks work with "Load scenario: Health pilot". Health therefore suits both Chloe and eligibility, and **every scene uses the one brief**. The F4 assertion (status "Feasible" after "go ahead") is the first test of this path on Health, and #146 must keep it.

## Story arc

| Section | Target | Scenes | Story |
|---|---|---|---|
| Hook | 15 s | title card + `H1` | The problem and the one-line promise |
| Founder | 60 s | title card + `F1`–`F8` | Sign-up, Chloe, the brief, the route, Why this route?, change a constraint, publish |
| Builder | 50 s | title card + `B1`–`B4`, `A1`, `B5` | Sign-up, profile, credential, project to Showcase, admin verification, Eligible · Python, bid |
| Connect | 35 s | title card + `C1`–`C3` | The bid on the dashboard, propose, counter, accept, confirmed |
| Close | 15 s | `X1` + CTA card | The public Showcase, then the call to action |

Scenes are recorded in story order, which is also the order the data needs:

1. The founder publishes before the builder bids.
2. The admin confirms before the builder sees the verdict.

## Scene table

Seconds include on-screen time only. Title cards are listed separately and counted in [Timing](#timing). Captions are at most 8 words. Voiceover lines are paced at about 2.5 words per second, never more than 3. Anything the founder or builder types is demo data (AGENTS.md rule 5).

| ID · clip | s | On screen | Caption | Voiceover | MeTTa rule / fact named |
|---|---|---|---|---|---|
| `H1` · `H1-landing` | 11 | Signed-out landing page `/`. The hero "A founding team you can verify." The cursor rests on "Route my venture". | A founding team you can verify. | (Starts over the hook card.) A founder has one question: who can credibly build my MVP, and why should I trust the answer? Venture Route answers with named MeTTa rules over verified facts. If it can't be done, you see the gap. | Named MeTTa rules (general) |
| `F1` · `F1-signup` | 7 | `/sign-up`: "Who are you?", then "I’m a founder", then "Continue as founder", then "Create your founder account". The real Clerk form with a `+clerk_test` email and code 424242. It lands on "Describe your MVP". | A new founder signs up | A brand-new founder signs up through the real Clerk form and chooses the founder role. | — |
| `F2` · `F2-chloe-brief` | 6 | The founder turns on the "Voice: Chloe" switch (in the main region). The consent caption appears and Chloe's greeting shows as a caption. The founder clicks "Load scenario: Health pilot". | Chloe, the voice intake, joins in | She turns on Chloe, the voice intake, and loads the Health pilot brief. | — |
| `F3` · `F3-review` | 7 | "Confirm your brief": the "Venture brief" form as pills. Python, AI / MeTTa and UI/UX design are checked, Hybrid is selected and Daily budget is 400. | The brief, as editable chips | Every field is an editable chip: three skills, hybrid, 22 to 29 September, USD 400 a day. | `brief-skill` facts (python, ai-metta, ui-ux) |
| `F4` · `F4-voice-confirm` | 8 | "Back to chat". Chloe's read-back and "Shall I find your route?" show as captions. "Start voice mode", then the founder says "go ahead". Chloe: "Finding your route." | Say "go ahead"; Chloe sends the brief | Chloe reads the brief back. The founder says go ahead, and the same brief goes to the engine. | — |
| `F5` · `F5-route` | 8 | "Your route through BASIX". The status badge reads Feasible. Builder cards: Amina Otieno (Both), Daniel Kiptoo (Both) and Grace Wambui (Credential), each with a Demo data pill. The cost strip shows USD 370 / day against USD 400 / day. The IP card shows `asset-afya-triage` and the partner card shows `amani-health`. | Feasible: three verified builders, USD 370 | The eligible-builder rule picks three verified builders for USD 370 a day. reuse-fit finds licensable IP to build on. | `eligible-builder`, `verified-for-skill`, `reuse-fit` |
| `F6` · `F6-why` | 8 | "Why this route?" opens. The Founder view shows the partner path, then the Technical view tab shows the same facts in monospace. | Why this route? Named rules, exact facts | Why this route names every rule. partner-fit walks four hops: amani-health, omni-university, cohort-2026a, Amina. | `partner-fit`: `(supports-vertical amani-health health)`, `(partners-with amani-health omni-university)`, `(cohort-of cohort-2026a omni-university)`, `(belongs-to amina-otieno cohort-2026a)` |
| `F7` · `F7-change-constraint` | 10 | **Judge moment.** "Change brief". Daily budget is set to 250, then "Find my route". The badge reads Partial, there are no builder cards, and one gap reads `assembler.budget-fit` "Cheapest verified team costs USD 370 a day; budget is USD 250". The founder clicks "Raise daily budget to USD 370", then "Find my route", and the badge reads Feasible. | Budget 250: the gap comes first | Cut the budget to 250. No team is shown as affordable: the gap comes first, with its fix. Raise it to 370, and it's feasible again. | `assembler.budget-fit` (D-22) over MeTTa's `eligible-builder` tuples |
| `F8` · `F8-publish` | 4 | "Publish as request". The founder's Home shows the "Briefs and routes" table with a Health pilot row marked Open. | Published as a request for builders | One click publishes it as a request. | — |
| `B1` · `B1-signup` | 5 | `/sign-up`: "I’m a builder", then "Continue as builder", then "Create your builder account". The real Clerk form with a `+clerk_test` email. It lands on the builder Home with "Complete your profile". | A new builder signs up | Now a new builder signs up and chooses the builder role. | — |
| `B2` · `B2-profile` | 8 | "Complete your profile" opens "Your profile". The "Builder profile" form gets: Display name, Primary location / base Nairobi, Day rate 120, Remote and Hybrid, self-described Python, a Skill set entry, the availability window 22 Sep – 20 Oct 2026, GitHub profile and LinkedIn profile. "Save profile" shows "Profile saved." and "Pending BASIX confirmation". | Profile: rate, modes, availability, links | She adds her day rate, work modes, availability, skill set, GitHub and LinkedIn. Typed skills stay self-described. | `has-self-described-skill`: display only, never `verified-for-skill` (AGENTS.md rule 4) |
| `B3` · `B3-credential` | 5 | The "Add credential" form: Credential title, Issuer "MeTTa OmniUniversity", Skill Python. "Add credential" adds a row to the Credentials list marked Pending. | A Python credential, pending review | She adds a Python credential. Until BASIX confirms it, it proves nothing. | `earned`, `proves`, and `confirmed` is still missing |
| `B4` · `B4-project-showcase` | 7 | `/profile/projects/new`, "Add a showcase project": Project title, vertical Health, skill Python, Completion date. "Submit for confirmation" returns to "Your profile". On the project row, "Edit showcase": Description, Live URL, Demo URL and Pitch deck URL, with "Show on Showcase" switched on. "Save showcase details" shows "Showcase details saved." and the row reads Pending review. | A project, put on the Showcase | Then a past project, switched onto the public Showcase, also waiting for review. | `built`, `demonstrates` |
| `A1` · `A1-verify` | 12 | The admin "Review queue". Confirm the account (the "Last decision" status shows `projected_rows`), then the Credentials tab and Confirm, then the Projects tab and Confirm. Then the Showcase tab and Confirm, which shows `Confirmed showcase "<title>"`. | Admin confirms; facts enter MeTTa | A BASIX admin confirms the account, credential, project and Showcase entry. Each decision rebuilds the MeTTa space: projected_rows rises. | `confirmed` facts; `projected_rows` |
| `B5` · `B5-eligible-bid` | 11 | Back as the builder on `/requests`, "Open requests". The Health pilot card reads "Eligible · Python". "Bid" opens the dialog "Bid on <title>" with day rate 120 and a message. "Submit bid" shows "Bid placed · USD 120 / day". | Eligible · Python: the rule holds | The founder's request now says eligible for Python. eligible-builder holds: a confirmed credential, a hybrid fit and overlapping dates. She bids. | `eligible-builder` = `verified-for-skill` ∧ `mode-compatible` ∧ `available-for-brief` ∧ confirmed account |
| `C1` · `C1-bid` | 12 | The founder's `/dashboard`. The "Bids to review" region shows the builder's name and "USD 120 / day". "Book interview" opens "Book an interview with <name>". The founder picks 24 September 2026, "10:30 EAT" and "30 min", and the summary reads "Thu 24 Sep 2026 · 10:30 – 11:00 EAT". "Send proposal" opens "Interview with <name>" with the step at Proposed. | The bid lands; founder proposes a time | The bid lands on the founder's dashboard. She proposes a thirty-minute interview inside the builder's confirmed availability. | — |
| `C2` · `C2-counter` | 9 | The builder opens the booking. Actions, then "Counter": 25 September 2026, "09:00 EAT", "45 min", then "Send counter". The page reads "Countered · awaiting the founder" and the History list has 2 entries. | Builder counters with another time | The builder counters with a morning slot: forty-five minutes, the next day. | — |
| `C3` · `C3-confirmed` | 12 | The founder opens the booking. Actions, then "Accept". The step reads Confirmed. The History list reads "Founder proposed", "Builder countered", "Founder confirmed". The page says "The interview is confirmed." | Accepted: the interview is confirmed | The founder accepts. Proposed, countered, confirmed: a founder and a verified builder, connected, with the full history on record. | Booking states `proposed → countered → confirmed` |
| `X1` · `X1-showcase-close` | 11 | Signed out, `/showcase`: the "Showcase" gallery shows the builder's project card with its Demo data pill. Clicking the card opens the detail page: the project title as heading, the description, and the Builder panel with the builder's name. | Public Showcase: confirmed work only | Every confirmed project lands on the public Showcase, where founders browse what builders have actually shipped. | Display only, never a MeTTa fact (D-43) |

### Visible assertions per scene

The demo spec asserts only what a judge sees (spec #143 Testing). A scene's clip counts only if its assertion passes. Strings come from the source and the Clerk specs named under prior art.

| ID | Visible assertion | Prior art |
|---|---|---|
| `H1` | heading level 1 "A founding team you can verify."; link "Route my venture" visible | `features/landing/LandingPage.tsx` |
| `F1` | heading level 1 "Who are you?", then "Create your founder account", then "Describe your MVP" | `features/auth/SignInScreen.tsx`, `e2e/clerk/helpers.ts` `HOME_HEADING` |
| `F2` | switch "Voice: Chloe" on; text `/sends your audio to Google/` visible; `spoken()[0]` equals `GREETING` | `e2e/chloe.spec.ts` |
| `F3` | heading level 1 "Confirm your brief"; form "Venture brief" has Python, AI / MeTTa and UI/UX design checked, Hybrid selected, Daily budget 400 | `e2e/scenarios.spec.ts`, `features/brief/BriefEditor.tsx` |
| `F4` | text "Shall I find your route?" visible; after `tapAndSay("go ahead")` the `POST /api/conversation` answer has `type: "route"`; `status-badge` reads "Feasible" | `e2e/chloe.spec.ts` |
| `F5` | `status-badge` "Feasible"; builder names `["Amina Otieno", "Daniel Kiptoo", "Grace Wambui"]`; evidence badges `["Both", "Both", "Credential"]`; `cost-strip` contains "USD 370 / day"; `ip-card` contains `asset-afya-triage`; `partner-card` contains `amani-health` | `e2e/scenarios.spec.ts` (Health pilot) |
| `F6` | dialog "Why this route?"; `path-partner` contains "partner-fit" and the four facts in order; tab "Technical view" shows the same facts in monospace | `e2e/scenarios.spec.ts` (Why this route?) |
| `F7` | after budget 250: `status-badge` "Partial", 0 builder cards, one gap containing `assembler.budget-fit`; after "Raise daily budget to USD 370": Daily budget 370; after "Find my route": "Feasible" | `e2e/scenarios.spec.ts` (budget change) |
| `F8` | heading "Home"; table "Briefs and routes" has a row containing "Health pilot" and "Open" | `e2e/clerk/sprint4-health-request.spec.ts` |
| `B1` | heading level 1 "Create your builder account", then heading "Home" | `features/auth/SignInScreen.tsx`, `e2e/clerk/helpers.ts` |
| `B2` | "Profile saved." and "Pending BASIX confirmation" visible | `e2e/clerk/marketplace.spec.ts` |
| `B3` | list "Credentials" item named with the credential title contains "Pending" | `e2e/clerk/marketplace.spec.ts` |
| `B4` | heading level 1 "Your profile"; "Showcase details saved."; the project row contains "Pending review" | `e2e/clerk/showcase.spec.ts` |
| `A1` | each confirmed row leaves its queue; `projected_rows` in status "Last decision" rises after account, credential and project; `Confirmed showcase "<title>"` | `e2e/clerk/marketplace.spec.ts`, `e2e/clerk/showcase.spec.ts` |
| `B5` | heading level 1 "Open requests"; the request card's `verdict` reads exactly "Eligible · Python"; "Bid placed · USD 120 / day" | `e2e/clerk/sprint4-health-request.spec.ts` |
| `C1` | region "Bids to review" contains the builder name and "USD 120 / day"; summary "Thu 24 Sep 2026 · 10:30 – 11:00 EAT"; heading "Interview with <name>"; current step "Proposed" | `e2e/clerk/requests.spec.ts` |
| `C2` | "Countered · awaiting the founder"; History has 2 items | `e2e/clerk/requests.spec.ts` |
| `C3` | current step "Confirmed"; History items "Founder proposed", "Builder countered", "Founder confirmed"; "The interview is confirmed." | `e2e/clerk/requests.spec.ts` |
| `X1` | signed-out `/showcase` heading "Showcase"; article named with the project title has "Demo data"; the detail page heading level 1 is the project title; complementary "Builder" contains the builder name | `e2e/clerk/showcase.spec.ts` |

## The "change a constraint" judge moment (`F7`)

- **Constraint:** the **daily budget**, USD 400 → 250, then back up to 370 with the gap's own button.
- **What visibly changes:**
  1. The badge goes Feasible → **Partial**.
  2. Every builder card disappears, so no team is shown as affordable when it is not (D-22).
  3. The gaps panel shows one gap naming its rule, `assembler.budget-fit`, with the statement "Cheapest verified team costs USD 370 a day; budget is USD 250".
  4. Its next action is a button, "Raise daily budget to USD 370". One click sets the budget to 370, and "Find my route" turns the badge back to **Feasible**.
- **What to say:** the gap is decided by the deterministic assembler (D-09) over the builders MeTTa's `eligible-builder` rule returned. Neither the LLM nor the UI chooses the status.
- **Why this constraint:** it is the one change-a-constraint flow already proven in the browser on the Health pilot (`scenarios.spec.ts`, "budget change"). It also ends Feasible, so `F8` publishes a request a builder can bid on.

## Timing

| Section | Items (seconds) | Total |
|---|---|---|
| Hook | title card 4 + `H1` 11 | 15 |
| Founder | title card 2 + `F1` 7 + `F2` 6 + `F3` 7 + `F4` 8 + `F5` 8 + `F6` 8 + `F7` 10 + `F8` 4 | 60 |
| Builder | title card 2 + `B1` 5 + `B2` 8 + `B3` 5 + `B4` 7 + `A1` 12 + `B5` 11 | 50 |
| Connect | title card 2 + `C1` 12 + `C2` 9 + `C3` 12 | 35 |
| Close | `X1` 11 + CTA card 4 | 15 |
| **Total** | 19 scene clips + 5 title cards | **175 s (2:55), at most 180 s** |

The render step trims dead time, such as the sign-out and sign-in between roles and reprojection waits (#51), down to these targets. It never hides a failed assertion.

## Title cards (render step)

| Card | Seconds | Text |
|---|---|---|
| Hook | 4 | **Who can credibly build your MVP, and why trust the answer?** / Venture Route uses MeTTa reasoning to route a founder's MVP brief to verified builders, and shows exactly why. |
| Founder | 2 | **Founder** / Sign up · Chloe · route · publish |
| Builder | 2 | **Builder** / Sign up · profile · verified · bid |
| Connect | 2 | **Connect** / Bid · propose · counter · confirmed |
| Close / CTA | 4 | **A founding team you can verify.** / github.com/simpleHacker0893/basix-venture-route · BASIX hackathon · MeTTa track |

## Narration script (one take)

The Operator reads this straight through, about 2.5 words per second. Each bracket is the scene it covers and its length, so the reading can follow the cut.

> **[Hook card + H1, 15 s]** A founder has one question: who can credibly build my MVP, and why should I trust the answer? Venture Route answers with named MeTTa rules over verified facts. If it can't be done, you see the gap.
>
> **[Founder card + F1, 9 s]** A brand-new founder signs up through the real Clerk form and chooses the founder role.
>
> **[F2, 6 s]** She turns on Chloe, the voice intake, and loads the Health pilot brief.
>
> **[F3, 7 s]** Every field is an editable chip: three skills, hybrid, 22 to 29 September, USD 400 a day.
>
> **[F4, 8 s]** Chloe reads the brief back. The founder says go ahead, and the same brief goes to the engine.
>
> **[F5, 8 s]** The eligible-builder rule picks three verified builders for USD 370 a day. reuse-fit finds licensable IP to build on.
>
> **[F6, 8 s]** Why this route names every rule. partner-fit walks four hops: amani-health, omni-university, cohort-2026a, Amina.
>
> **[F7, 10 s]** Cut the budget to 250. No team is shown as affordable: the gap comes first, with its fix. Raise it to 370, and it's feasible again.
>
> **[F8, 4 s]** One click publishes it as a request.
>
> **[Builder card + B1, 7 s]** Now a new builder signs up and chooses the builder role.
>
> **[B2, 8 s]** She adds her day rate, work modes, availability, skill set, GitHub and LinkedIn. Typed skills stay self-described.
>
> **[B3, 5 s]** She adds a Python credential. Until BASIX confirms it, it proves nothing.
>
> **[B4, 7 s]** Then a past project, switched onto the public Showcase, also waiting for review.
>
> **[A1, 12 s]** A BASIX admin confirms the account, credential, project and Showcase entry. Each decision rebuilds the MeTTa space: projected_rows rises.
>
> **[B5, 11 s]** The founder's request now says eligible for Python. eligible-builder holds: a confirmed credential, a hybrid fit and overlapping dates. She bids.
>
> **[Connect card + C1, 14 s]** The bid lands on the founder's dashboard. She proposes a thirty-minute interview inside the builder's confirmed availability.
>
> **[C2, 9 s]** The builder counters with a morning slot: forty-five minutes, the next day.
>
> **[C3, 12 s]** The founder accepts. Proposed, countered, confirmed: a founder and a verified builder, connected, with the full history on record.
>
> **[X1, 11 s]** Every confirmed project lands on the public Showcase, where founders browse what builders have actually shipped.
>
> **[CTA card, 4 s]** Venture Route: a founding team you can verify.

## Shot checklist

### Before recording

- [ ] Clean stack: `docker compose down -v`, then `docker compose up`. The e2e reset leaves seed-only atoms.
- [ ] The web build sets `VITE_VOICE_PROVIDER=fake`, so `window.__chloeVoice` exists. The Clerk config's build does not set it today, so the demo harness (#145) must.
- [ ] The engine runs with `LLM_PROVIDER=null`, so routes and Chloe's lines are deterministic.
- [ ] A fresh founder and builder use unique `+clerk_test` addresses (code 424242). The admin is the harness's bootstrapped admin (`ADMIN_EMAILS`). No real person's data is on screen.
- [ ] Video is 1920×1080 with moderate `slowMo`, one worker and no retries. The caption overlay is keyed by scene ID.
- [ ] The demo spec has passed twice in a row from a clean `docker compose up`, and both runs are pasted (spec #143).

### Per scene (tick when the clip is in and its assertion passed)

- [ ] `H1` The hero is readable and the "Route my venture" button is in frame
- [ ] `F1` The role cards and "Create your founder account" are on screen; the email code step is trimmed
- [ ] `F2` The Voice: Chloe switch is on; the greeting caption is visible
- [ ] `F3` The skill pills are readable at 1080p
- [ ] `F4` The read-back caption and the "go ahead" caption are visible; the route appears
- [ ] `F5` The gaps-before-team order holds (no gaps here); three cards; Demo data pills visible
- [ ] `F6` The partner-fit facts are legible in both views
- [ ] `F7` Partial, the budget gap and its button, then Feasible again
- [ ] `F8` The Health pilot row is Open
- [ ] `B1` "Create your builder account", then Home
- [ ] `B2` Every field the story names is filled; "Pending BASIX confirmation" is visible
- [ ] `B3` The credential row reads Pending
- [ ] `B4` The project row reads Pending review
- [ ] `A1` `projected_rows` is visible after each confirm, and the Showcase confirm message appears
- [ ] `B5` "Eligible · Python" is held on screen at least 2 s before Bid
- [ ] `C1` The bid is in "Bids to review"; the proposal summary is visible
- [ ] `C2` Countered, with the History list visible
- [ ] `C3` Confirmed, with all three History entries visible
- [ ] `X1` The gallery card, then the detail page with the Builder panel

### After recording

- [ ] The rendered MP4 is at most 3:00 and has 19 scene clips plus 5 title cards (ffprobe output pasted).
- [ ] Muted playback: every scene still reads from its caption alone.
- [ ] The narration was recorded against the cut, and each line fits its bracket.
