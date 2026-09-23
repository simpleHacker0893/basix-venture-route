# Stitch prompt pack — Venture Route

Copy-paste prompts for Google Stitch. One screen per prompt, generated in the batch order below.
Source of truth for tokens and screens: the PRD (sections 4.2 and 4.3). If Stitch output and this file disagree, this file wins.

> **Status (2026-09-22):** executed. Stitch project "Venture Route Design System" (`projects/14240170250148839149`) holds the DESIGN.md block as its design system and all 15 screens below. Exports live under `design/stitch/batch-{1,2,3,4}/<screen-slug>/`; `design/stitch/README.md` maps each prompt to its folder and Stitch screen ID and documents how 2.2 and 3.3 were generated through the MCP from Claude Code.

## How to use this pack

1. Create one Stitch project called **Venture Route**. Target: **Web, desktop, 1440 px wide**.
2. Open the project's design system settings and paste the whole `DESIGN.md` block below. Stitch passes it to the model as hard constraints, so every screen inherits the tokens.
3. Generate screens **in batch order**. Paste one prompt, wait for the screen, then paste the next. Do not paste two screens in one prompt.
4. Refine with **one change per message** ("move the Gaps panel above the team cards"), never "fix everything".
5. When a batch is done, shift-select all its screens and paste the **Consistency pass** prompt once.
6. Export each screen as **HTML/Tailwind** (and Figma if you want a canvas copy). Save exports under `design/stitch/<batch>/<screen-slug>/` in this repo and commit.
7. Return to Claude Code and paste the **Return prompt** at the end of this file.

Batch 1 is the demo floor and unblocks Sprint 002. Batches 3 and 4 are not needed until Sprints 003 and 004.

---

## DESIGN.md (paste into the Stitch project design system)

```markdown
# Venture Route design system

Product: a founder-facing web app that turns a plain-language venture brief into an evidence-backed route through the BASIX ecosystem. The route is decided by MeTTa graph rules, never by an AI guess. Every recommendation shows its evidence. Every gap is named honestly.

Tone: calm, editorial, trustworthy. Think a well-set research report, not a SaaS dashboard. No gradients, no glassmorphism, no neon, no stock illustrations, no emoji.

## Colour tokens (use these exact hex values)
- ground: #f4f1ea (page background, warm off-white)
- surface: #fbf9f4 (cards), surface-strong: #ffffff (elevated cards, inputs)
- dark: #16181b (dark sections, footer, technical view backgrounds)
- ink: #16181b (primary text), ink-2: #3f4650 (secondary text), ink-3: #5c6169 (captions, helper text)
- accent: #1e5a45 deep green (primary buttons, links, Verified state, Credential evidence badge)
- accent-on-dark: #7fd1ac light green (accent text and outlines on dark sections)
- project: #35418a indigo (Project evidence badge, project chips)
- amber-ink: #8a4b12 and amber-fill: #e8c58f (Demo data label, gap states, Partial status)
- danger: #8a2d2d (Infeasible status, validation errors, reject actions)
- border: #e3ded3 (hairlines, card borders); border-strong: #c9c2b3
- Success/verified uses accent green; never a separate bright green.

## Typography
- Display: Fraunces (serif), used for page titles and hero headlines. Weights 500-600. Sizes 44/36/28 px.
- Body: IBM Plex Sans, 16 px base, 24 px line height. Headings inside cards: 20 px semibold.
- Mono: IBM Plex Mono, 13-14 px, used for rule names (e.g. `verified-for-skill`), evidence paths, day rates, IDs and the Technical view.
- Captions: 13 px, ink-3.

## Layout
- Desktop-first at 1440 px. Content max width 1200 px, centred. 12-column grid, 24 px gutters.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Corners: 8 px on cards and inputs, 999 px on chips and badges. Shadows: none or a 1 px border; use a soft 0 1px 2px rgba(22,24,27,0.06) shadow only on the elevated drawer.
- Top navigation: 64 px tall, ground background, hairline bottom border. Left: wordmark "Venture Route" in Fraunces. Right: text links and one primary button.
- Must degrade to tablet (1024 px). Mobile is out of scope for these designs.

## Components (shadcn/ui vocabulary)
- Buttons: primary = accent fill, white text, 40 px tall, 8 px radius. Secondary = surface-strong fill, 1 px border-strong. Ghost = text only. Never more than one primary button per view.
- Chips: 999 px radius, 32 px tall, editable chips show a small pencil icon; removable chips show an x.
- Badges: 24 px tall pill. Evidence badges read exactly "Credential" (accent), "Project" (project indigo), "Both" (accent fill with an indigo dot). Status badges read "Feasible" (accent), "Partial" (amber), "Infeasible" (danger).
- Demo data label: a small amber pill reading "Demo data" that appears on every card derived from seed records. Never hidden.
- Cards: surface fill, 1 px border, 24 px padding, 8 px radius.
- Drawer: right-side sheet, 560 px wide, surface-strong, closes with an x and the Escape key.
- Tables: hairline rows, no zebra striping, mono for numbers.
- Calendar: shadcn Calendar in range mode for availability, two months side by side, selected range filled with accent at 12% opacity, endpoints solid accent.
- Forms: labels above inputs, 13 px ink-2, helper text 13 px ink-3, error text danger.

## Content rules
- Founder-friendly language first, then the MeTTa decision layer, then inspectable evidence. On every screen this order is the visual hierarchy.
- Gaps are always shown before team cards.
- Rule names always appear in mono, exactly as written: verified-for-skill, mode-compatible, available-for-brief, eligible-builder, reuse-fit, partner-fit, route-gap.
- All people, credentials, projects, cohorts, universities and partners are fictional demo data and say so.
- Currency is shown as "USD 180 / day" in mono.
- Dates are shown as "22 Sep – 6 Oct 2026".
```

---

## Batch 1 — Founder routing floor (unblocks Sprint 002)

### 1.1 Founder chat and intake (screen 3)

```text
Design the "Founder intake" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Layout: top navigation with wordmark "Venture Route", links "How it works", "For builders", and a secondary button "Sign in". Below it a two-column layout inside a 1200 px container: left column 760 px is a chat thread, right column 400 px is a sticky "Your brief so far" panel.

Chat thread: a Fraunces title "Describe your MVP" with a one-line caption in ink-2: "Plain language is fine. We will ask for anything missing." Show three messages: (1) founder message in a surface-strong bubble aligned right: "I want to build a maternal health triage pilot for clinics in Nakuru. I need Python, AI with MeTTa and a UI designer, hybrid, this month, about 400 dollars a day. Reusing existing health IP would be great." (2) assistant message aligned left with no avatar, in a surface card: "Got it. Two things are missing before I can route this: your team-size ceiling and an end date for the work. How many people at most, and when should the work finish?" (3) an empty founder composer at the bottom: a 2-line text area with placeholder "Reply here…", a primary button "Send", and a ghost link "Use the form instead" beneath it.

Above the composer show three small chip buttons labelled "Load scenario: Health pilot", "Agri marketplace", "Constrained brief" in ink-2 with a hairline border.

Right panel "Your brief so far": a card listing extracted fields as editable chips. Filled chips: "Vertical: Health", "Skills: Python, AI/MeTTa, UI/UX", "Mode: Hybrid", "Budget: USD 400 / day", "Reusable IP: Preferred". Missing fields shown as dashed outline chips in ink-3: "Team size: missing", "Dates: missing". Below the chips a disabled primary button "Find my route" with helper text "Fill the missing fields to continue." Under the panel a small amber "Demo data" pill and a caption: "Routes are computed by MeTTa rules over demo records. The assistant only translates your words."

No illustrations. No emoji. Calm, editorial.
```

### 1.2 Brief review (screen 4)

```text
Design the "Brief review" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Same top navigation as the intake screen. A 1200 px container with a Fraunces title "Confirm your brief" and a caption in ink-2: "Edit anything that is wrong. Your latest correction wins."

Main area: a single wide card (surface, 24 px padding) with a two-column form grid. Fields, each with a label above and an editable chip or input:
- Title: text input with value "Maternal health triage pilot"
- Vertical: a segmented control with "Health" selected, "Agri", "Education"
- Required skills: a chip group with removable chips "Python", "AI/MeTTa", "UI/UX" and a ghost "+ Add skill" chip
- Maximum team size: a numeric stepper showing 3
- Availability: a date-range field showing "22 Sep – 6 Oct 2026" that opens a shadcn two-month Calendar in range mode; show the calendar popover open, with the range highlighted in accent at 12 percent and the endpoints solid accent
- Delivery mode: segmented control "Remote", "Hybrid" selected, "On-site"
- Location: text input, disabled with helper "Required only for on-site"
- Daily budget: input with prefix "USD" and value "400", suffix "/ day"
- Prefer reusable IP: a toggle switched on with the label "Prefer reusable IP"

Bottom right of the card: a ghost button "Back to chat" and a primary button "Find my route". Under the card a caption row: a small amber "Demo data" pill, then "Routing uses named MeTTa rules. Nothing here is decided by a language model."

Show one inline validation example: the Daily budget field with a danger-coloured error message "Budget must be a positive number" under it, to document the error state. Keep everything else in the normal state.
```

### 1.3 Route result, feasible (screen 5)

```text
Design the "Route result" screen for Venture Route at 1440 px desktop in the FEASIBLE state, following the project design system exactly.

Top navigation as before. Below it a 1200 px container.

Header row: Fraunces title "Your route through BASIX", a status badge "Feasible" in accent green next to it, and on the right two secondary buttons "Change brief" and "Export handoff" plus a ghost button "Why this route?". Under the title a one-paragraph summary in body text: "A three-person verified team covers Python, AI/MeTTa and UI/UX for USD 370 a day, under your USD 400 ceiling. A licensable health triage asset from the Lakeview cohort can shorten the build."

Then a cost strip: a full-width card with three mono figures side by side: "Total day rate USD 370", "Your budget USD 400", "Headroom USD 30", with a thin progress bar in accent showing 370 of 400.

Section "Team (3 of max 3)": three builder cards in a row. Each card: name in 20 px semibold, a role line in ink-2, a "Demo data" amber pill top right, an evidence badge, a mono day rate, and a "Covers" chip row. Card 1: "Amina Otieno", "Backend builder, Lakeview cohort", badge "Both", "USD 140 / day", covers "Python". Card 2: "Tendai Moyo", "MeTTa developer", badge "Credential", "USD 150 / day", covers "AI/MeTTa". Card 3: "Wanjiru Kamau", "Product designer", badge "Project", "USD 80 / day", covers "UI/UX". Each card has a ghost link "View evidence path".

Section "Context": three cards side by side. "Reusable IP" card: title "Clinic triage intake flow", a pill "Licensable", caption "Fits vertical: Health, skills: Python, UI/UX", ghost link "Evidence path". "Cohort and university" card: "Lakeview cohort 2026 · Nairobi Technical University". "Partner" card: "Amani Health Network", caption "Supports vertical: Health, partners with Nairobi Technical University".

Footer strip inside the container, dark background #16181b with light green accent text: "Rules applied: verified-for-skill · mode-compatible · available-for-brief · eligible-builder · reuse-fit · partner-fit" in mono.

No gaps panel in this state. Calm, editorial, no illustrations.
```

### 1.4 Route result, partial with gaps (screen 5, gap state)

```text
Design the "Route result" screen for Venture Route at 1440 px desktop in the PARTIAL state, using the same layout as the feasible route result screen but with these differences, following the project design system exactly.

Header: title "Your route through BASIX" with an amber status badge "Partial". Summary paragraph: "Rust can be covered, but no verified builder is available for Mobile within 22 Sep – 6 Oct 2026. Below are the approved next actions."

Directly under the header and BEFORE any team card, a "Gaps" panel: a full-width card with a 4 px amber left border. Title "Gaps (1)". One gap row: a mono rule tag "route-gap", a category pill "Skill", the statement "No builder is verified for Mobile with availability overlapping 22 Sep – 6 Oct 2026.", an "Affected: Mobile" chip, and a "Next actions" list with two items: "Extend the availability window to at least 13 Oct 2026" and "Remove Mobile from required skills or accept a self-described builder for display only". Each next action has a small secondary button "Apply".

Then the cost strip showing "Total day rate USD 160", "Your budget USD 300", "Headroom USD 140".

Section "Team (1 of max 2)": one builder card "Kofi Mensah", "Systems builder", badge "Credential", "USD 160 / day", covers "Rust", with "Demo data" pill and "View evidence path" link. Next to it an empty dashed placeholder card reading "Mobile: no eligible builder" in ink-3 with a small amber pill "Gap".

Context section: "Reusable IP" card in an empty state reading "No licensable asset fits this brief", cohort card filled "Ridgeway cohort 2026 · Coast Polytechnic", partner card filled "Savanna Systems Guild".

Dark footer strip listing rules: "verified-for-skill · available-for-brief · eligible-builder · route-gap".
```

### 1.5 Why this route? drawer (screen 6)

```text
Design the "Why this route?" evidence drawer for Venture Route at 1440 px desktop, following the project design system exactly. Show the feasible route result screen dimmed behind a right-side drawer 560 px wide, surface-strong background, with a close x in the top right.

Drawer header: Fraunces title "Why this route?" and a caption "Every recommendation below comes from a named MeTTa rule over source facts." Under it a two-option segmented control: "Founder view" selected, "Technical view".

Founder view body, scrollable, grouped by recommendation with a small heading per group:

Group "Amina Otieno covers Python": an evidence badge "Both", then an ordered list of source facts in mono at 13 px, each on its own line with a step number:
1. (earned amina-otieno cred-py-201)
2. (proves cred-py-201 python)
3. (built amina-otieno proj-clinic-intake)
4. (demonstrates proj-clinic-intake python)
5. (available amina-otieno 2026-09-15 2026-10-20)
6. (supports-mode amina-otieno hybrid)
Then a conclusion line in body text: "Rule verified-for-skill holds by credential and by project; rule eligible-builder holds." with the rule names in mono.

Group "Clinic triage intake flow is reusable": badge "Rule reuse-fit", facts "(vertical asset-triage health)", "(licensable asset-triage)", "(demonstrates asset-triage python)", conclusion "Fits the Health vertical and one required skill."

Group "Amani Health Network is a partner fit": badge "Rule partner-fit", four facts showing the multi-hop chain: "(supports-vertical amani health)", "(partners-with amani nairobi-tech)", "(cohort-of lakeview-2026 nairobi-tech)", "(belongs-to amina-otieno lakeview-2026)", conclusion "Partner reached through the university of the selected builder's cohort."

At the bottom of the drawer a dark #16181b block labelled "Technical view preview" showing one mono query line in light green: "!(eligible-builder brief-health-01 $builder $skill $evidence)" and a caption "Full query and rule bodies appear in Technical view."

Drawer footer: a secondary button "Copy evidence" and a ghost button "Close".
```

### Consistency pass (paste once with all Batch 1 screens selected)

```text
Apply the project design system strictly to every selected screen: same 64 px top navigation, same 1200 px container, Fraunces only for page titles, IBM Plex Sans body at 16 px, IBM Plex Mono for rule names, rates and facts. Ensure every card derived from demo records carries the amber "Demo data" pill, every status badge uses the exact words Feasible, Partial or Infeasible, and gaps always appear above team cards. Remove any illustration, gradient or emoji that slipped in.
```

---

## Batch 2 — Landing, handoff, auth (Sprint 002 second half)

### 2.1 Landing page (screen 1)

```text
Design the Venture Route landing page at 1440 px desktop, following the project design system exactly. Long scrolling page, ground background, editorial tone.

Sections in order:
1. Navigation: wordmark, links "How it works", "Evidence", "For builders", secondary button "Sign in", primary button "Route my venture".
2. Hero: left column with a Fraunces headline "The smallest credible route through BASIX." and a sub-headline in ink-2: "Describe your MVP. Get a verified team, reusable IP, a cohort and a partner, with the evidence to trust it. Honest gaps when it cannot be done." Two buttons: primary "Route my venture", ghost "See a demo route". Right column: a framed screenshot placeholder of the route result screen with a small amber "Demo data" pill on it.
3. "How it works": three numbered steps in cards: "1. Describe your MVP in plain language", "2. Confirm the brief we extracted", "3. Get a route decided by MeTTa rules, with evidence". Each with a two-line caption.
4. "Evidence, not vibes": a dark #16181b section with light green accent text. Left: a heading "Every recommendation names its rule and its facts." Right: a mono block showing three facts and a rule name, styled like the evidence drawer.
5. "For builders": two cards, "Verified profile" and "Bid where you are eligible", with a secondary button "Create a builder profile".
6. Footer on dark background: wordmark, a line "Built for the BASIX hackathon, SingularityNET MeTTa track. All records are fictional demo data.", links "GitHub", "PRD", "Privacy".
```

### 2.2 Venture handoff export (screen 7)

```text
Design the "Venture handoff" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation as before. A 1200 px container with a Fraunces title "Venture handoff" and caption "A plain-text summary you can share with a co-founder, mentor or BASIX operator."

Main: a two-column layout. Left 760 px: a surface-strong card containing a read-only monospace text block, 14 px, with this content laid out as plain text with headings in capitals: "VENTURE ROUTE HANDOFF", "Brief: Maternal health triage pilot", "Vertical: Health", "Skills: Python, AI/MeTTa, UI/UX", "Window: 22 Sep – 6 Oct 2026", "Mode: Hybrid", "Budget: USD 400 / day", "STATUS: Feasible", "TEAM", three lines with name, skill covered, evidence type and day rate, "TOTAL DAY RATE: USD 370", "REUSABLE IP: Clinic triage intake flow (licensable)", "COHORT: Lakeview cohort 2026, Nairobi Technical University", "PARTNER: Amani Health Network", "RULES APPLIED: verified-for-skill, mode-compatible, available-for-brief, eligible-builder, reuse-fit, partner-fit", "All records are demo data."

Right 400 px: a card with a primary button "Copy to clipboard", a secondary button "Download .txt", a caption "Generated from the structured route result only. No language model text is included." and an amber "Demo data" pill.
```

### 2.3 Sign up and sign in (screen 2)

```text
Design the "Sign in" screen for Venture Route at 1440 px desktop, following the project design system exactly. This screen wraps a Clerk prebuilt sign-in component, so design the frame, not the form internals.

Centre a 480 px wide surface-strong card on the ground background with the wordmark above it. Inside the card, a placeholder region 400 by 360 px labelled "Clerk <SignIn /> component" with a hairline border. Above the placeholder a Fraunces title "Welcome back" and caption "Founders and builders sign in here. Routing does not require an account."

Under the card a role selector shown as two large selectable cards side by side, used on sign-up: "I am a founder" with caption "Post requests and book interviews" and "I am a builder" with caption "Verified profile, showcase projects, bids", the founder card selected with an accent border. Below: a caption "Accounts are confirmed by a BASIX admin before they appear in routes or bids."
```

---

## Batch 3 — Marketplace profiles and admin (Sprint 003)

### 3.1 Student profile (screen 8)

```text
Design the "Builder profile" edit screen for Venture Route at 1440 px desktop, following the project design system exactly. This is the student or builder's own profile.

Navigation with an avatar-less account menu "Amina Otieno". A 1200 px container, Fraunces title "Your profile", caption "Founders see this. Skills show as verified only when a credential or completed project proves them and an admin confirms it."

Left column 760 px, stacked cards:
- "Skills" card: a list of skill rows. Each row: skill name, a verification pill, and an evidence note. Rows: "Python – Verified (Both)" accent pill; "AI/MeTTa – Verified (Credential)" accent pill; "UI/UX – Self-described" ink-3 outline pill with caption "Display only. Not used for routing."; "Rust – Pending admin confirmation" amber pill. A ghost "+ Add skill" button.
- "Availability" card: a shadcn two-month Calendar in range mode with "15 Sep – 20 Oct 2026" selected, plus a mono day-rate input "USD 140 / day".
- "Delivery" card: checkboxes "Remote" checked, "Hybrid" checked, "On-site" unchecked, and a "Location" input "Nakuru, Kenya".
Right column 400 px:
- "Account status" card: pill "Confirmed by BASIX admin" in accent, cohort line "Lakeview cohort 2026 · Nairobi Technical University", amber "Demo data" pill.
- "Contact sharing" card: three toggles "Share email", "Share phone", "Share LinkedIn" with the first on, caption "Founders only see what you switch on."
- primary button "Save profile".
```

### 3.2 Add or edit project (screen 9)

```text
Design the "Add project" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation as the profile screen. A 760 px centred card with Fraunces title "Add a showcase project" and caption "Projects become facts the graph reasons over once an admin confirms them."

Fields: "Title" input "Clinic triage intake flow"; "Vertical" segmented control with Health selected; "Skills demonstrated" chip group with "Python" and "UI/UX" and "+ Add skill"; "Summary" text area, three lines; "Links" two URL inputs with a "+ Add link" ghost; "Licensable as reusable IP" toggle on, with caption "Founders may be routed to this asset when it fits their brief. This is a demo claim, not a legal one."; "Completion date" single date picker showing 12 Aug 2026.

Footer: ghost "Cancel", primary "Submit for confirmation". Under the card a status strip showing what happens next: three small steps "Submitted", "Admin review", "Live in graph" with the first active.
```

### 3.3 Candidate profile, founder view (screen 12)

```text
Design the "Candidate profile" screen as a founder sees it, for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation with a founder account menu "Cpt. N". Container with a back link "← Back to route", then a header card: name "Amina Otieno" in Fraunces 36 px, role line "Backend builder · Lakeview cohort 2026 · Nairobi Technical University", pills "Confirmed by admin" (accent) and "Demo data" (amber), a mono "USD 140 / day", availability "15 Sep – 20 Oct 2026", modes "Remote, Hybrid", location "Nakuru, Kenya". Right side of the header: primary button "Book interview", secondary "Add to request".

Below, two columns. Left 760 px: "Verified skills" card listing "Python – Both", "AI/MeTTa – Credential" with a ghost "View evidence path" per row; "Projects" card with one project card "Clinic triage intake flow" with pills "Licensable", "Health" and skills chips. Right 400 px: "Evidence summary" card showing the mono facts list identical in style to the Why this route drawer, and a "Shared contact" card showing only "Email: shared" and "Phone: not shared".
```

### 3.4 Admin queue (screen 14)

```text
Design the "Admin queue" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation with an admin account menu "BASIX admin". Fraunces title "Confirmation queue", caption "Only confirmed accounts, credentials and projects appear in routes and bids."

Tabs: "Accounts (4)" selected, "Credentials (3)", "Projects (2)".

A table with hairline rows and columns: Name, Role, Cohort, Submitted, Actions. Four rows of fictional people, e.g. "Kofi Mensah · Builder · Ridgeway cohort 2026 · 21 Sep 2026", "Lerato Dube · Founder · — · 21 Sep 2026". Actions per row: a small primary "Confirm" and a small danger-outline "Reject". Each row carries a tiny amber "Demo data" pill next to the name.

Right rail 320 px: a card "What confirming means" with three bullet lines: "Accounts: appear in routes and can bid", "Credentials: become proof for the skill they name", "Projects: become proof and, if licensable, reusable IP". Below it a card "Recently confirmed" listing three names with timestamps.

Include one selected row expanded inline showing the credential detail: mono fact preview "(earned kofi-mensah cred-rust-311) (proves cred-rust-311 rust)" and the buttons "Confirm credential" and "Reject".
```

---

## Batch 4 — Requests and interviews (Sprint 004)

### 4.1 Requests board (screen 10)

```text
Design the "Requests board" screen as a builder sees it, for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation with the builder account menu. Fraunces title "Open requests", caption "You can bid only where the eligible-builder rule holds for your profile." with the rule name in mono.

Filter row: chips "All", "Eligible for me" selected, "Health", "Agri", "Education".

A list of request cards, each full width: title, founder name, vertical pill, skills chip row, window "22 Sep – 6 Oct 2026", mode, budget in mono, and on the right an eligibility indicator and action. Card 1 "Maternal health triage pilot" with indicator pill "Eligible · Python" in accent and a primary button "Bid". Card 2 "Agri input marketplace" with indicator "Not eligible · availability overlap too short" in ink-3 outline and a disabled button "Bid". Card 3 "Cross-border logistics tracker" with indicator "Not eligible · Mobile not verified" and disabled button. Each card has an amber "Demo data" pill.

Show a bid dialog open over card 1: 480 px modal with title "Bid on Maternal health triage pilot", a read-only line "Your eligible skills: Python", a mono day-rate input "USD 140 / day", a short message text area, ghost "Cancel", primary "Submit bid".
```

### 4.2 Founder dashboard (screen 11)

```text
Design the "Founder dashboard" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation with the founder account menu "Cpt. N". Fraunces title "Your ventures", and a primary button "New brief" top right.

A four-tile summary row with mono numbers: "Briefs 3", "Routes 3", "Open requests 1", "Bids received 4", "Bookings 2".

Below, a two-column layout. Left 760 px: a "Briefs and routes" table with columns Brief, Status, Team, Day rate, Updated, and rows "Maternal health triage pilot · Feasible · 3 · USD 370 · today", "Agri input marketplace · Feasible · 2 · USD 260 · yesterday", "Cross-border logistics tracker · Partial · 1 · USD 160 · 2 days ago", with status badges in the exact colours. Right 400 px: a "Bids received" card listing four bids with builder name, skill, mono day rate, and small secondary "View" buttons; a "Upcoming interviews" card listing two bookings with date, time in Africa/Nairobi and builder name. Every row carries an amber "Demo data" pill.
```

### 4.3 Interview booking (screen 13)

```text
Design the "Interview booking" screen for Venture Route at 1440 px desktop, following the project design system exactly.

Navigation with the founder account menu. Fraunces title "Book an interview with Amina Otieno", caption "Times are shown in Africa/Nairobi."

Left 760 px: a card with a shadcn single-month Calendar for October 2026 with 6 Oct selected, and next to it a column of time slot buttons "09:00", "10:30", "14:00" with "10:30" selected in accent. Below: a "Duration" segmented control "30 min" selected, "45 min", and a "Notes to builder" text area.

Right 400 px: a "Summary" card: builder name, "Tue 6 Oct 2026 · 10:30 – 11:00 EAT", "Video link will be added in-app", amber "Demo data" pill, primary button "Propose time". Under it a "Status" card showing the booking state machine as three steps "Proposed" active, "Accepted", "Confirmed", and a note "Amina can accept or counter-propose from her side."

Also show, smaller and below, the builder's counter-propose variant of the summary card: "Amina proposed Wed 7 Oct 2026 · 14:00" with buttons secondary "Counter" and primary "Accept".
```

---

## Batch 5 — Chloe voice intake (Sprint 006, D-38)

### 5.1 Founder intake, voice state (screen 3, voice variant)

```text
Design the "Founder intake" screen for Venture Route at 1440 px desktop in its VOICE state, following the project design system exactly. Calm, editorial, trustworthy. No illustrations, gradients or emoji. No waveform graphics.

Same layout as the intake screen (1.1): navigation, a 1200 px container, left column 760 px chat thread, right column 400 px sticky "Your brief so far" panel.

Left column header row: title "Describe your MVP", caption "Plain language is fine. We will ask for anything missing.", and on the right a toggle switch labelled "Voice: Chloe" in the ON state.

Chat thread with four messages: (1) founder message in a surface-strong bubble aligned right: "I want to build a maternal health triage pilot for clinics in Nakuru. I need Python, AI with MeTTa and a UI designer, hybrid, this month, about 400 dollars a day." (2) assistant message aligned left in a surface card, no avatar: "To route this brief I still need:" followed by "- vertical: health, agri or education?" and "- maximumTeamSize: how many people at most (1 to 5)?" (3) directly under it a Chloe turn: a small accent label "Chloe" and italic text "Which vertical is it for: health, agri, or education?" (4) a status row below the thread: a small pulsing dot, "Chloe is speaking", and a ghost button "Stop Chloe".

Composer: a round 48 px microphone button on the left in the PRESSED state (accent fill, subtle outer ring) with the label "Hold to talk" under it; a 2-line text area showing an interim transcript in ink-3 italics "Health, for clinics in Nakuru, and three people at most…"; a primary button "Send"; a ghost link "Use the form instead". Above the composer the three scenario chips from 1.1.

Under the composer two 13 px captions in ink-3: "Voice uses your browser's speech service: Chrome sends your audio to Google for transcription." and, in a small inset labelled "Unsupported browser", the variant "Voice needs Chrome or Edge." with no microphone button.

Right panel as in 1.1 with filled chips "Skills: Python, AI/MeTTa, UI/UX", "Mode: Hybrid", "Budget: USD 400 / day", dashed missing chips "Vertical: missing", "Team size: missing", "Dates: missing", the disabled "Find my route" button with helper "Fill the missing fields to continue.", the amber "Demo data" pill and the caption "Routes are computed by MeTTa rules over demo records. The assistant only translates your words."
```

---

## Return prompt for Claude Code (paste after exports are committed)

```text
Stitch exports for Venture Route are committed under design/stitch/<batch>/<screen-slug>/ (HTML/Tailwind). Follow the Operating Pack in AGENTS.md and the current sprint under planning/sprints/. Convert each export into React 19 + TypeScript components in apps/web using shadcn/ui primitives and the tokens in docs/design/stitch-prompts.md (DESIGN.md block), keeping the screen structure but replacing hard-coded demo copy with props typed from packages/contracts. Wire the screens to the conversation API and route contract, keep the Demo data label on every seed-derived card, keep gaps above team cards, and add the Vitest/RTL tests the sprint's acceptance.md names. Do not alter the design tokens. Report deviations from the Stitch layout in the sprint completion report.
```
