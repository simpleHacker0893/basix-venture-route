# Demo video: plan and script

The plan and script for the Venture Route demo video (spec #143, ticket #144). Every later demo ticket follows it: the Playwright demo harness (#145), the scene recordings (#146–#148), the render step and `SUBMISSION.md`.

- **Length:** 175 s planned, inside the 180 s limit (see [Timing](#timing)).
- **Recording:** the local stack from a clean `docker compose up`, on the existing Clerk harness, with `+clerk_test` accounts, 1920×1080 video and caption overlays added by the harness.
- **Engine:** runs on the real LLM provider configured in the root `.env`, so Chloe really extracts the founder's spoken brief (ruling R6, spec #143 story 7).
- **Voiceover:** the Operator records it over the finished cut.
- **One story:** a founder describes her MVP to Chloe and gets a route, a builder gets verified, and the two meet through a bid and an interview booking. The video closes on the public Showcase.

Scene IDs (`H1`, `F1`–`F8`, `B1`–`B5`, `A1`, `C1`–`C3`, `X1`) and clip names are **stable**. The harness, the render step and any re-recording use them verbatim.

## The brief and skill for the video

**Brief:** the Health pilot. The founder speaks it to Chloe, and `F4` normalises it on camera to the routing fields of `brief-health-01`. **Builder skill:** Python (`python`). The builder ends up **"Eligible · Python"** on the founder's published request.

### Why this brief

| Need | Health pilot + Python | Agri marketplace |
|---|---|---|
| A fresh builder with one confirmed credential sees "Eligible · <skill>" on the published request | Proven by `apps/web/e2e/clerk/sprint4-health-request.spec.ts` with Python: modes Remote and Hybrid, availability 2026-09-22 → 2026-10-20, one confirmed `python` credential, verdict "Eligible · Python" | No Clerk spec proves an Agri verdict. (`requests.spec.ts` proves "Eligible · Mobile" on the Constrained brief, which is Partial.) |
| Chloe can take it by voice | Yes. The real provider extracts the spoken brief, and the [no-key fallback](#no-key-fallback-chip-path) loads the same brief from its chip | Yes, and the chip path is proven by `apps/web/e2e/chloe.spec.ts` |
| MeTTa story on screen | `reuse-fit` (`asset-afya-triage`), four-hop `partner-fit` (`amani-health`), and the budget-change moment already proven on this brief in `apps/web/e2e/scenarios.spec.ts` | `reuse-fit` and `partner-fit` too, but no proven change-a-constraint moment |

Chloe works with either brief, so eligibility and the MeTTa story decide it. **Every scene uses the one brief.**

### The founder's spoken brief (verbatim)

The harness feeds this line through the fake voice hook (`tapAndSay`), and the overlay shows it as the founder's words. It states each field explicitly, because the extraction instruction (`services/engine/app/llm/anthropic_adapter.py`, `EXTRACTION_INSTRUCTION`) returns only fields the founder states and never infers one:

> "I'm building Health pilot: triage assistant for community clinics. It's for the health vertical. I need Python, AI / MeTTa and UI/UX design skills, with at most 3 builders. The work runs from 22 September 2026 to 29 September 2026, hybrid, and my budget is 50 US dollars an hour."

The line **deliberately leaves out reusable IP**. If every field were stated, the engine would route at once (`Orchestrator.handle` routes as soon as no field is missing), and the founder would never see the brief before it is routed. Leaving one field out has two effects:

- The engine answers with a clarification, and Chloe asks for the one missing field (`F3`). That shows "she asks for anything missing".
- The founder then reviews and corrects the brief as editable chips before anything is routed (`F4`).

### Stabilisation: why the exact values after F4 hold (story 25)

A real model may mishear or drift on a field. The plan makes the result reproducible anyway:

1. **`F4` normalises on camera.** In the editable "Venture brief" form, the founder checks every routing field and corrects any that drifted to the `brief-health-01` value:
   - Title "Health pilot: triage assistant for community clinics"
   - Vertical Health
   - Skills exactly Python, AI / MeTTa and UI/UX design
   - Maximum team size 3
   - Availability 22–29 Sep 2026
   - Mode Hybrid
   - Budget per hour (USD) 50
   - Prefer reusable IP on

   A field that already matches is left alone, so on camera only the drift and the missing reusable-IP answer change. The brief that enters routing therefore always equals `brief-health-01` in every routing field. This is also story 9 ("review the extracted brief as editable chips"), done visibly.
2. **Assertions before `F4` are structural.** `F2` and `F3` assert only fields the line states plainly: vertical Health, Python among the skills, and a non-missing budget. From `F4` on, assertions are exact, because the brief is.
3. **Route outcomes come from MeTTa over seed facts plus confirmed rows.** The route is deterministic once the brief is fixed. The model only writes the route summary (D-09), which no assertion reads.
4. **Two clean passes.** The demo spec must pass twice in a row from a clean `docker compose up`, with no retries, and both runs are pasted. A pass with drift still counts, because `F4` corrected it on camera. A failed assertion fails the take.

### Invariants `B5` needs ("Eligible · Python")

`eligible-builder` must hold for the published request's brief and the demo builder:

- **Python is required.** The request's skills include `python`, and the builder has a confirmed `python` credential (`verified-for-skill`).
- **The mode fits.** The brief mode is remote or hybrid (here hybrid), and the builder supports Remote and Hybrid (`mode-compatible`, `mode-accepts`).
- **The dates overlap.** The brief window overlaps the builder's 22 Sep – 20 Oct 2026 by at least 2 days (`MIN_OVERLAP_DAYS`, `available-for-brief`). Here the window is 22–29 Sep.
- **The account is confirmed** (`A1`).
- **Budget does not affect eligibility.** It only affects the team. The published budget is USD 47 an hour after `F7` (at least 47 keeps the route Feasible), and the builder's hourly rate is USD 15.

## Story arc

| Section | Target | Scenes | Story |
|---|---|---|---|
| Hook | 15 s | title card + `H1` | The problem and the one-line promise |
| Founder | 60 s | title card + `F1`–`F8` | Sign-up, the spoken brief, Chloe asks what's missing, chip review, the route, Why this route?, change a constraint, publish |
| Builder | 50 s | title card + `B1`–`B4`, `A1`, `B5` | Sign-up, profile, credential, project to Showcase, admin verification, Eligible · Python, bid |
| Connect | 35 s | title card + `C1`–`C3` | The bid on the dashboard, propose, counter, accept, confirmed |
| Close | 15 s | `X1` + CTA card | The public Showcase, then the call to action |

Scenes are recorded in story order, which is also the order the data needs:

1. The founder publishes before the builder bids.
2. The admin confirms before the builder sees the verdict.

## Scene table

- Seconds count on-screen time only. Title cards are listed separately and counted in [Timing](#timing).
- Captions are at most 8 words.
- Voiceover lines are paced at about 2.5 words per second, never more than 3.
- Anything the founder or builder types is demo data (AGENTS.md rule 5).

| ID · clip | s | On screen | Caption | Voiceover | MeTTa rule / fact named |
|---|---|---|---|---|---|
| `H1` · `H1-landing` | 11 | The signed-out landing page `/`, with the hero "A founding team you can verify." The cursor rests on "Route my venture". | Named MeTTa rules over verified facts | (Starts over the hook card.) A founder has one question: who can credibly build my MVP, and why should I trust the answer? Venture Route answers with named MeTTa rules over verified facts. If it can't be done, you see the gap. | Named MeTTa rules (general) |
| `F1` · `F1-signup` | 6 | `/sign-up`: "Who are you?" → "I’m a founder" → "Continue as founder" → "Create your founder account". The real Clerk form with a `+clerk_test` email and code 424242. It lands on "Describe your MVP". | A new founder signs up | A brand-new founder signs up through the real Clerk form and chooses the founder role. | — |
| `F2` · `F2-chloe-brief` | 7 | The founder turns on the "Voice: Chloe" switch in the main region. The consent caption appears and Chloe's greeting shows as a caption. "Start voice mode", then the founder says [the spoken brief](#the-founders-spoken-brief-verbatim), shown as a transcript caption. "Your brief so far" fills in. | She describes her MVP to Chloe | She turns on Chloe and describes her MVP out loud: skills, team, dates, mode and budget. | — |
| `F3` · `F3-chloe-asks` | 6 | "Your brief so far" shows the extracted chips (Vertical: Health, Skills: … Python …, Budget: USD 50 an hour) and "Reusable IP: missing". Chloe asks, as a caption: "Should I look for reusable IP you could build on? Yes or no." | Chloe asks only for what's missing | The brief fills in live. Chloe asks only for what's missing: reusable IP. | — |
| `F4` · `F4-review` | 8 | "Use the form instead" (voice mode ends when the founder leaves the chat, D-55). The "Venture brief" form opens with the extracted values as editable pills. The founder corrects any drifted field to the `brief-health-01` values (see [Stabilisation](#stabilisation-why-the-exact-values-after-f4-hold-story-25)) and ticks "Prefer reusable IP". "Find my route" leads to "Your route through BASIX". | Review the chips, fix any drift | She reviews every field as an editable chip, fixes anything misheard, adds reusable IP, and finds her route. | `brief-skill` facts (python, ai-metta, ui-ux) |
| `F5` · `F5-route` | 7 | "Your route through BASIX". The status badge reads Feasible. Builder cards: Amina Otieno (Both), Daniel Kiptoo (Both), Grace Wambui (Credential), each with a Demo data pill. The cost strip shows USD 47 an hour against USD 50 an hour. The IP card shows `asset-afya-triage` and the partner card shows `amani-health`. | Feasible: three verified builders, USD 47 an hour | The eligible-builder rule picks three verified builders for USD 47 an hour. reuse-fit adds licensable IP. | `eligible-builder`, `verified-for-skill`, `reuse-fit` |
| `F6` · `F6-why` | 7 | "Why this route?" opens. The Founder view shows the partner path, then the "Technical view" tab shows the same facts in monospace. | Why this route? Named rules, exact facts | Why this route names every rule. partner-fit walks four hops: amani-health, omni-university, cohort-2026a, Amina. | `partner-fit`: `(supports-vertical amani-health health)`, `(partners-with amani-health omni-university)`, `(cohort-of cohort-2026a omni-university)`, `(belongs-to amina-otieno cohort-2026a)` |
| `F7` · `F7-change-constraint` | 14 | **Judge moment** ([details](#the-change-a-constraint-judge-moment-f7)). (a) "Change brief", tick Mobile, "Find my route": Partial, with the gaps panel **above** the team. One `route-gap` names mobile, and the three builder cards sit beneath it. (b) "Change brief", untick Mobile, Budget per hour 31, "Find my route": Partial, no builder cards, and one gap: `assembler.budget-fit` "Cheapest verified team costs USD 47 an hour; budget is USD 31 an hour". (c) "Raise the hourly budget to USD 47", then "Find my route": Feasible. | Change a constraint: the gap comes first | Change a constraint. Add mobile: route-gap finds no verified mobile builder, so the gap sits above the team. Cut the budget to 31 an hour: no affordable team. Raise to 47: feasible again. | `route-gap` (skill); `assembler.budget-fit` (D-22) over MeTTa's `eligible-builder` tuples |
| `F8` · `F8-publish` | 3 | "Publish as request". The founder's Home shows the Health pilot as a request in the "Briefs and routes" list, marked "Open request". | Published as a request for builders | One click publishes it as a request. | — |
| `B1` · `B1-signup` | 5 | `/sign-up`: "I’m a builder" → "Continue as builder" → "Create your builder account". The real Clerk form with a `+clerk_test` email. It lands on the builder Home with "Complete your profile". | A new builder signs up | Now a new builder signs up and chooses the builder role. | — |
| `B2` · `B2-profile` | 8 | "Complete your profile" opens "Your profile". The "Builder profile" form: Display name, Primary location / base Nairobi, Hourly rate (USD, 0–50) 15, Remote and Hybrid, self-described Python, a Skill set entry, the availability window 22 Sep – 20 Oct 2026, GitHub profile, LinkedIn profile. "Save profile" shows "Profile saved." and "Pending BASIX confirmation". | Profile: rate, modes, availability, links | She adds her hourly rate, work modes, availability, skill set, GitHub and LinkedIn. Typed skills stay self-described. | `has-self-described-skill`: display only, never `verified-for-skill` (AGENTS.md rule 4) |
| `B3` · `B3-credential` | 5 | The "Add credential" form: Credential title, Issuer "MeTTa OmniUniversity", Skill Python. "Add credential" adds a row to the Credentials list marked Pending. | A Python credential, pending review | She adds a Python credential. Until BASIX confirms it, it proves nothing. | `earned`, `proves`; `confirmed` still missing |
| `B4` · `B4-project-showcase` | 7 | `/profile/projects/new`, "Add a showcase project": Project title, vertical Health, skill Python, Completion date. "Submit for confirmation" returns to "Your profile". On the project row, "Edit showcase": Description, Live URL, Demo URL, Pitch deck URL, and "Show on Showcase" on. "Save showcase details" shows "Showcase details saved." and the row reads Pending review. | A project, put on the Showcase | Then a past project, switched onto the public Showcase, also waiting for review. | `built`, `demonstrates` |
| `A1` · `A1-verify` | 12 | The admin "Review queue". Confirm the account (the "Last decision" status shows `projected_rows`). Then the Credentials tab → Confirm, the Projects tab → Confirm, and the Showcase tab → Confirm, which shows `Confirmed showcase "<title>"`. | Admin confirms; facts enter MeTTa | A BASIX admin confirms the account, credential, project and Showcase entry. Each decision rebuilds the MeTTa space: projected_rows rises. | `confirmed` facts; `projected_rows` |
| `B5` · `B5-eligible-bid` | 11 | Back as the builder on `/requests`, "Open requests". The Health pilot card reads "Eligible · Python". "Bid" opens the dialog "Bid on <title>" (hourly rate 15, pre-filled from the profile, and a message). "Submit bid" shows "Bid placed · USD 15 an hour". | Eligible · Python: the rule holds | The founder's request now says eligible for Python. eligible-builder holds: a confirmed credential, a hybrid fit and overlapping dates. She bids. | `eligible-builder` = `verified-for-skill` ∧ `mode-compatible` ∧ `available-for-brief` ∧ confirmed account |
| `C1` · `C1-bid` | 12 | The founder's `/dashboard`. The "Bids to review" region shows the builder's name and "USD 15 an hour". "Book interview" opens "Book an interview with <name>". The founder picks 24 September 2026, "10:30 EAT" and "30 min". The summary reads "Thu 24 Sep 2026 · 10:30 – 11:00 EAT". "Send proposal" opens "Interview with <name>", with the step at Proposed. | The bid lands; founder proposes a time | The bid lands on the founder's dashboard. She proposes a thirty-minute interview inside the builder's confirmed availability. | — |
| `C2` · `C2-counter` | 9 | The builder opens the booking. Actions → "Counter": 25 September 2026, "09:00 EAT", "45 min", then "Send counter". The screen reads "Countered · awaiting the founder", and History has 2 entries. | Builder counters with another time | The builder counters with a morning slot: forty-five minutes, the next day. | — |
| `C3` · `C3-confirmed` | 12 | The founder opens the booking. Actions → "Accept". The step reads Confirmed. History reads "Founder proposed", "Builder countered", "Founder confirmed", and the screen says "The interview is confirmed." | Accepted: the interview is confirmed | The founder accepts. Proposed, countered, confirmed: a founder and a verified builder, connected, with the full history on record. | Booking states `proposed → countered → confirmed` |
| `X1` · `X1-showcase-close` | 11 | Signed out, `/showcase`: the "Showcase" gallery shows the builder's project card with its Demo data pill. The card opens the detail page: the project title as heading, the description, and the Builder panel with the builder's name. | Public Showcase: confirmed work only | Every confirmed project lands on the public Showcase, where founders browse what builders have actually shipped. | Display only, never a MeTTa fact (D-43) |

### Visible assertions per scene

The demo spec asserts only what a judge sees (spec #143 Testing). A scene's clip counts only if its assertion passes. Strings come from the source and from the specs named under prior art.

| ID | Visible assertion | Prior art |
|---|---|---|
| `H1` | heading level 1 "A founding team you can verify."; link "Route my venture" visible | `features/landing/LandingPage.tsx` |
| `F1` | heading level 1 "Who are you?", then "Create your founder account", then "Describe your MVP" | `features/auth/SignInScreen.tsx`, `e2e/clerk/helpers.ts` `HOME_HEADING` |
| `F2` | **Structural.** Switch "Voice: Chloe" is on, and `spoken()[0]` equals `GREETING`. After `tapAndSay(<spoken brief>)`, `POST /api/conversation` answers `type: "clarification"` (not a validation error). In the aside "Your brief so far", list "Brief fields" has a Vertical chip "Health", a Skills chip containing "Python", and a Budget chip that is not "missing". | `e2e/chloe.spec.ts`, `features/intake/BriefPanel.tsx`, `lib/briefChips.ts` |
| `F3` | **Structural.** `spoken()` ends with one entry of `QUESTIONS` (`chloe/script.ts`). It is the reusable-IP question when the extraction was exact. The Brief fields list still shows at least one "missing" chip. | `chloe/script.ts`, `features/intake/BriefPanel.tsx` |
| `F4` | Before normalising (structural): form "Venture brief" visible, radio "Health" checked, checkbox "Python" checked, Budget per hour (USD) not empty. After normalising (exact): Python, AI / MeTTa and UI/UX design checked and no other skill; Hybrid checked; Budget per hour (USD) 50; "Prefer reusable IP" checked. Then heading level 1 "Your route through BASIX". | `e2e/scenarios.spec.ts` (form path), `features/brief/BriefEditor.tsx` |
| `F5` | `status-badge` "Feasible"; builder names `["Amina Otieno", "Daniel Kiptoo", "Grace Wambui"]`; evidence badges `["Both", "Both", "Credential"]`; `cost-strip` contains "USD 47 an hour"; `ip-card` contains `asset-afya-triage`; `partner-card` contains `amani-health` | `e2e/scenarios.spec.ts` (Health pilot) |
| `F6` | dialog "Why this route?"; `path-partner` contains "partner-fit" and the four facts in order; tab "Technical view" shows the same facts in monospace | `e2e/scenarios.spec.ts` (Why this route?) |
| `F7` | (a) `status-badge` "Partial"; `gaps-panel` precedes `team-section` in the document; one gap containing "route-gap" and "mobile"; 3 builder cards. (b) "Partial", 0 builder cards, one gap containing `assembler.budget-fit`. (c) after "Raise the hourly budget to USD 47": Budget per hour (USD) 47; after "Find my route": "Feasible". | (a) `e2e/scenarios.spec.ts` (Constrained brief: gaps panel precedes the team, mobile `route-gap`). (b, c) `e2e/scenarios.spec.ts` (budget change) |
| `F8` | heading "Home"; list "Briefs and routes" has an item, named by the request title, containing "Health pilot" and "Open" | `e2e/clerk/sprint4-health-request.spec.ts` |
| `B1` | heading level 1 "Create your builder account", then heading "Home" | `features/auth/SignInScreen.tsx`, `e2e/clerk/helpers.ts` |
| `B2` | "Profile saved." and "Pending BASIX confirmation" visible | `e2e/clerk/marketplace.spec.ts` |
| `B3` | list "Credentials" item named with the credential title contains "Pending" | `e2e/clerk/marketplace.spec.ts` |
| `B4` | heading level 1 "Your profile"; "Showcase details saved."; the project row contains "Pending review" | `e2e/clerk/showcase.spec.ts` |
| `A1` | each confirmed row leaves its queue; `projected_rows` in status "Last decision" rises after the account, the credential and the project; `Confirmed showcase "<title>"` | `e2e/clerk/marketplace.spec.ts`, `e2e/clerk/showcase.spec.ts` |
| `B5` | heading level 1 "Open requests"; the request card's `verdict` reads exactly "Eligible · Python"; "Bid placed · USD 15 an hour" | `e2e/clerk/sprint4-health-request.spec.ts` |
| `C1` | region "Bids to review" contains the builder name and "USD 15 an hour"; summary "Thu 24 Sep 2026 · 10:30 – 11:00 EAT"; heading "Interview with <name>"; current step "Proposed" | `e2e/clerk/requests.spec.ts` |
| `C2` | "Countered · awaiting the founder"; History has 2 items | `e2e/clerk/requests.spec.ts` |
| `C3` | current step "Confirmed"; History items "Founder proposed", "Builder countered", "Founder confirmed"; "The interview is confirmed." | `e2e/clerk/requests.spec.ts` |
| `X1` | signed-out `/showcase` heading "Showcase"; the article named with the project title has "Demo data"; detail page heading level 1 is the project title; complementary "Builder" contains the builder name | `e2e/clerk/showcase.spec.ts` |

Two flows are first proven by #146 rather than by an existing spec:

- **`F7`(a), Health plus Mobile.** It follows from the seed: no confirmed builder proves `mobile` (DOMAIN.md, Constrained brief). The remaining three skills are covered by the same three builders at USD 47 an hour.
- **`F2`–`F4`, the spoken path.**

## The "change a constraint" judge moment (`F7`)

- **Constraints changed:** first a required skill (add Mobile), then the hourly budget (USD 50 → 31 → 47 an hour).
- **What visibly changes:**
  1. **Add Mobile.** The badge goes Feasible → **Partial**. The gaps panel appears **above** the team (rule 6, story 10: gaps first, then the matched builders). Its one gap is MeTTa's `route-gap` for mobile, with its two fixed next actions (D-29). The same three builder cards stay below, because the other skills are still covered.
  2. **Remove Mobile, budget 31.** Still **Partial**, but every builder card disappears, so no team is shown as affordable when it is not (D-22). The one gap names `assembler.budget-fit`: "Cheapest verified team costs USD 47 an hour; budget is USD 31 an hour".
  3. **"Raise the hourly budget to USD 47".** One click sets the budget to 47, and "Find my route" turns the badge back to **Feasible**.
- **What to say:**
  - The skill gap comes from a named MeTTa rule (`route-gap`).
  - The budget gap comes from the deterministic assembler (D-09), working over the builders MeTTa's `eligible-builder` returned.
  - Neither the LLM nor the UI chooses the status.
- **Why these constraints:**
  - The budget flow is already proven in the browser on the Health pilot (`scenarios.spec.ts`, "budget change"), and it ends Feasible, so `F8` publishes a request a builder can bid on.
  - The Mobile step is the only way, inside this one brief, to show a partial route with gaps above builder cards (story 10). At USD 50 an hour the Health pilot has no gaps, and the budget gap empties the team by D-22.

## Timing

| Section | Items (seconds) | Total |
|---|---|---|
| Hook | title card 4 + `H1` 11 | 15 |
| Founder | title card 2 + `F1` 6 + `F2` 7 + `F3` 6 + `F4` 8 + `F5` 7 + `F6` 7 + `F7` 14 + `F8` 3 | 60 |
| Builder | title card 2 + `B1` 5 + `B2` 8 + `B3` 5 + `B4` 7 + `A1` 12 + `B5` 11 | 50 |
| Connect | title card 2 + `C1` 12 + `C2` 9 + `C3` 12 | 35 |
| Close | `X1` 11 + CTA card 4 | 15 |
| **Total** | 19 scene clips + 5 title cards | **175 s (2:55), at most 180 s** |

The render step trims dead time down to these targets. That includes the sign-out and sign-in between roles, the model's extraction latency in `F2`, route calls in `F4`/`F7`, and reprojection waits (#51). It never hides a failed assertion.

## Title cards (render step)

| Card | Seconds | Text |
|---|---|---|
| Hook | 4 | **Who can credibly build your MVP, and why trust the answer?** / Venture Route uses MeTTa reasoning to route a founder's MVP brief to verified builders, and shows exactly why. |
| Founder | 2 | **Founder** / Sign up · Chloe · route · publish |
| Builder | 2 | **Builder** / Sign up · profile · verified · bid |
| Connect | 2 | **Connect** / Bid · propose · counter · confirmed |
| Close / CTA | 4 | **A founding team you can verify.** / github.com/simpleHacker0893/basix-venture-route · BASIX hackathon · MeTTa track |

## Narration script (one take)

The Operator reads this straight through, at about 2.5 words per second. Each bracket names the scene it covers and its length, so the reading can follow the cut.

> **[Hook card + H1, 15 s]** A founder has one question: who can credibly build my MVP, and why should I trust the answer? Venture Route answers with named MeTTa rules over verified facts. If it can't be done, you see the gap.
>
> **[Founder card + F1, 8 s]** A brand-new founder signs up through the real Clerk form and chooses the founder role.
>
> **[F2, 7 s]** She turns on Chloe and describes her MVP out loud: skills, team, dates, mode and budget.
>
> **[F3, 6 s]** The brief fills in live. Chloe asks only for what's missing: reusable IP.
>
> **[F4, 8 s]** She reviews every field as an editable chip, fixes anything misheard, adds reusable IP, and finds her route.
>
> **[F5, 7 s]** The eligible-builder rule picks three verified builders for USD 47 an hour. reuse-fit adds licensable IP.
>
> **[F6, 7 s]** Why this route names every rule. partner-fit walks four hops: amani-health, omni-university, cohort-2026a, Amina.
>
> **[F7, 14 s]** Change a constraint. Add mobile: route-gap finds no verified mobile builder, so the gap sits above the team. Cut the budget to 31 an hour: no affordable team. Raise to 47: feasible again.
>
> **[F8, 3 s]** One click publishes it as a request.
>
> **[Builder card + B1, 7 s]** Now a new builder signs up and chooses the builder role.
>
> **[B2, 8 s]** She adds her hourly rate, work modes, availability, skill set, GitHub and LinkedIn. Typed skills stay self-described.
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

## No-key fallback (chip path)

Use this **only** when no LLM provider is configured, or the configured one is unavailable. With `LLM_PROVIDER=null`, `NullAdapter.extract_brief` extracts nothing from free speech, so a spoken brief cannot work. The take must then be labelled honestly:

- `F2` shows the extra caption "No-key fallback: scenario brief".
- The `F2`–`F4` voiceover changes as below.

Every other scene is unchanged, because the brief equals `brief-health-01` exactly. The clips are named `F2-chloe-brief-nokey`, `F3-chloe-asks-nokey` and `F4-review-nokey`, so the render step can never mix the two takes.

| ID | s | On screen | Caption | Voiceover |
|---|---|---|---|---|
| `F2` | 7 | Voice on (greeting caption), then "Load scenario: Health pilot" | No-key fallback: scenario brief | Without a model key, she loads the Health pilot scenario instead of speaking it. |
| `F3` | 6 | "Confirm your brief": the "Venture brief" form, with Python, AI / MeTTa and UI/UX design checked, Hybrid, and Budget per hour (USD) 50 | The brief, as editable chips | Every field is an editable chip: three skills, hybrid, 22 to 29 September, USD 50 an hour. |
| `F4` | 8 | "Back to chat". Chloe reads the brief back and asks "Shall I find your route?". "Start voice mode", then `tapAndSay("go ahead")` (a yes phrase, `chloe/confirm.ts`). Chloe says "Finding your route." | Say "go ahead"; Chloe sends the brief | Chloe reads the brief back. She says go ahead, and the same brief goes to the engine. |

The fallback assertions are exactly those of `e2e/chloe.spec.ts`, applied to the Health pilot chip: "Shall I find your route?" is visible, `POST /api/conversation` answers `type: "route"`, and `status-badge` reads "Feasible".

## Shot checklist

### Before recording

- [ ] Clean stack: `docker compose down -v`, then `docker compose up`. The e2e reset leaves seed-only atoms.
- [ ] The engine uses the real provider configured in the root `.env` (`LLM_PROVIDER=anthropic` or `openrouter`, with its key). Read variable names only, never values. The Clerk Playwright config hard-codes `LLM_PROVIDER: "null"` today, so the demo harness (#145) must pass the configured provider through. If no provider is configured, record the [no-key fallback](#no-key-fallback-chip-path) and label it.
- [ ] The web build sets `VITE_VOICE_PROVIDER=fake`, so `window.__chloeVoice` exists. The founder's words are injected, and extraction is real. The Clerk config's build does not set it today, so #145 must.
- [ ] A fresh founder and builder use unique `+clerk_test` addresses (code 424242). The admin is the harness's bootstrapped admin (`ADMIN_EMAILS`). No real person's data is on screen.
- [ ] Video is 1920×1080 with moderate `slowMo`, one worker and no retries. The caption overlay is keyed by scene ID.
- [ ] The demo spec has passed twice in a row from a clean `docker compose up`, and both runs are pasted (spec #143 story 25; see [Stabilisation](#stabilisation-why-the-exact-values-after-f4-hold-story-25)).

### Per scene (tick when the clip is in and its assertion passed)

- [ ] `H1` The hero is readable, and the "Route my venture" button is in frame
- [ ] `F1` The role cards and "Create your founder account" are on screen; the email code step is trimmed
- [ ] `F2` The Voice: Chloe switch is on; the greeting and the spoken-brief transcript captions are visible; the brief panel fills
- [ ] `F3` Chloe's question caption is visible; "Reusable IP: missing" is readable
- [ ] `F4` Every corrected field is visible as it changes; the form ends on the `brief-health-01` values
- [ ] `F5` Three cards, with Demo data pills visible
- [ ] `F6` The partner-fit facts are legible in both views
- [ ] `F7` The mobile gap above the three cards; then Partial with the budget gap and its button; then Feasible again
- [ ] `F8` The Health pilot row is Open
- [ ] `B1` "Create your builder account", then Home
- [ ] `B2` Every field the story names is filled; "Pending BASIX confirmation" is visible
- [ ] `B3` The credential row reads Pending
- [ ] `B4` The project row reads Pending review
- [ ] `A1` `projected_rows` is visible after each confirm; the Showcase confirm message appears
- [ ] `B5` "Eligible · Python" is held on screen at least 2 s before Bid
- [ ] `C1` The bid is in "Bids to review"; the proposal summary is visible
- [ ] `C2` Countered, with History visible
- [ ] `C3` Confirmed, with all three History entries visible
- [ ] `X1` The gallery card, then the detail page with the Builder panel

### After recording

- [ ] The rendered MP4 is at most 3:00, with 19 scene clips and 5 title cards (ffprobe output pasted).
- [ ] Muted playback: every scene still reads from its caption alone.
- [ ] The narration was recorded against the cut, and each line fits its bracket.
- [ ] If the fallback was used, the "No-key fallback" caption is in the `F2` clip.
