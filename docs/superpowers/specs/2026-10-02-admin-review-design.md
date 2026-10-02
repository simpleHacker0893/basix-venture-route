# Sprint 008: Admin review (D-60)

Brainstormed and approved with the Operator on 2026-10-02. Depends on Sprint 007 (hourly pricing, D-59): every rate and budget below is per hour.

## Goal

An admin reviews **people**, not scattered rows. One screen per person shows who they are and everything they submitted; accepting is one click, denying takes a reason the person can see and act on. The Showcase is one list the admin can keep or prune, and what the admin approves appears on the landing page. Nothing is deleted.

## Admin console layout

`/admin` (role `admin`, inside `AppShell`) has three tabs. The 965-line `apps/web/src/features/admin/AdminHome.tsx` is split into `features/admin/people/`, `features/admin/showcase/` and `features/admin/history/`, with a thin `AdminHome.tsx` holding the tabs and summary tiles.

### People

- One list of builders and founders. Filter: **Needs review** (default: the account or any of its items is pending), **Active** (account confirmed, nothing pending), **Removed** (account rejected). A role filter: All, Builders, Founders.
- Row: first name (first word of `display_name`; falls back to the part of the email before `@`), role, pending count, waiting since.
- Opening a row shows the **person summary** beside the list.

**Builder summary**, in this order:

1. Identity and contact: builder ID, email (a D-56 placeholder `…@pending.clerk.invalid` shows as "Email not received yet"), phone, LinkedIn, GitHub. Admin sees contact details regardless of the builder's share flags (they apply to founders, D-43).
2. Profile: headline, location, hourly rate, work modes, cohort.
3. Skills: verified skills with the credential or project that proves each (the projection's evidence), then self-described skills, labelled "Self-described".
4. Credentials: title, issuer, skill, issued date, link, status, each with Accept / Deny.
5. Projects: title, vertical, skills, links, licensable, status, each with Accept / Deny.
6. Showcase entries: status and links (decided in the Showcase tab).
7. Account: status with Accept / Deny, and **Accept all pending**.
8. History: every decision on this person with reasons, note, admin and time.

**Founder summary**: identity and contact (name, email), account status with Accept / Deny, every request they published (title, skills, budget per hour, status, number of bids) with **Close request** (needs a reason), and history.

The Clerk ID is not shown anywhere in the admin console.

### Showcase

- Every Showcase entry in one list, filterable by status: Pending, Live, Removed, Withdrawn.
- Pending: Accept / Deny. Live: **Remove** (needs a reason). Removed: **Restore**. Withdrawn (the builder turned `showcased` off): read-only, no actions (the engine already answers 409).
- Card: title, builder first name, vertical, skills, status, links as clickable links, and the D-43 warnings ("Project not yet confirmed", "Account not confirmed").

### History

Today's Decided tab, renamed: every decision with its reasons and note, and **Reverse**.

## Denials

- Deny, Remove and Close need at least one reason from a fixed list, plus an optional note (max 500 characters). A dialog shows the reasons as checkboxes; `other` requires the note.
- Reason codes: `identity` (can't verify identity), `credential_unverifiable`, `evidence_missing`, `broken_links`, `inappropriate`, `duplicate`, `other`.
- Accept and Restore need no reason.
- Denying an **account** leaves its pending items pending; the summary shows "Account removed" above them. A rejected account is already kept out of routes, bids and the Showcase.
- Nothing is deleted from the database or from Clerk.

## What the builder sees

- On `/profile` and `/home`, a denied credential, project, Showcase entry or account shows "Not accepted" with the reasons (as readable text) and the note.
- **Editing a denied item resubmits it**: the item returns to `pending`; the reasons stay in history.
  - New `PUT /api/me/credentials/{id}` (title, issuer, skill, issued date, link) and `PUT /api/me/projects/{id}` (title, vertical, skills, completion date, licensable, description, links). Editing a confirmed item also returns it to `pending` (same rule as the Showcase, D-43).
  - `PUT /api/me/profile` on a rejected account returns the account to `pending`.
- No email is sent (follow-up ticket).

## Landing page Showcase

- A **"Built by BASIX builders"** section on the landing page (`apps/web/src/features/landing/LandingPage.tsx`) shows the 6 most recently approved entries from the existing public `GET /api/showcase?limit=6` (already ordered by `showcase_confirmed_at` desc).
- Card: title, builder first name, vertical, skills, Demo data pill where `demoData`, link to `/showcase/:id`. **See all** links to `/showcase`. No contact details (D-43).
- Hidden when the API returns no entries or fails.
- Appears as soon as an admin accepts an entry and disappears when one is removed, because it reads the same public query.

## Sidebar on smaller screens

Below 1024 px (`lg`), a menu button in the top bar opens the full sidebar as a slide-over drawer for every signed-in role. It closes with ✕, Escape, a tap outside, or choosing a link; focus is trapped while open and returns to the button. The phone tab bar stays. At 1024 px and above the existing collapsible sidebar is unchanged.

## API (engine)

All under `/api/admin` (`require_role("admin")`).

| Method and path | Body | Answers |
|---|---|---|
| `GET /people?filter=needs_review\|active\|removed&role=builder\|founder` | | `PersonRow[]`: `{userId, builderId?, role, firstName, email, pendingCount, waitingSince, status}` |
| `GET /people/{userId}` | | `BuilderSummary` or `FounderSummary` (by role), with `history[]` of `{kind, targetId, decision, reasons, note, at, admin}` |
| `POST /people/{userId}/accept-all` | | confirms the account and every pending credential and project in one transaction, calls `reproject()` once, answers `{confirmed: n, projectedRows}` |
| `POST /confirm/{kind}/{id}` | | unchanged |
| `POST /reject/{kind}/{id}` | `{reasons: ReasonCode[1..], note?}` | 422 without a reason, or `other` without a note |
| `POST /requests/{requestId}/close` | `{reasons, note?}` | closes a founder's request as admin; answers `RequestOut` |
| `GET /showcase?status=pending\|live\|removed\|withdrawn` | | every Showcase entry with its status |

- `kind` stays `account | credential | project | showcase`. Every account, credential and project decision still calls `reproject()` (D-15); Showcase decisions do too (D-52).
- Builder-facing `/api/me/profile`, `/api/me/credentials`, `/api/me/projects` items gain `lastDecision: {decision, reasons, note, at} | null`.
- `clerkId` is removed from every admin response (`PendingAccount`, `DecidedAccount` and the new types).
- `GET /pending` and `GET /decided` stay until the web stops calling them; the last ticket of the sprint deletes them and their tests.

## Data: migration `0005_review_reasons`

- `confirmations.reasons text[] not null default '{}'` with a check that every element is one of the seven codes.
- `confirmations.note text null`, max 500 characters.
- Existing rows keep empty reasons.

## Contracts

Every new or changed wire type (`PersonRow`, `BuilderSummary`, `FounderSummary`, `DecisionHistoryEntry`, `RejectBody`, `ReasonCode`, `LastDecision`, `AdminShowcaseEntry`, the edit bodies) gets a Zod schema in `packages/contracts/src/marketplace.ts`, a Pydantic twin in `services/engine/app/marketplace/schemas.py`, and an entry in `packages/contracts/test/schema-parity.test.ts`.

## Tests (seams per D-19)

- Engine over HTTP: people filters; builder and founder summaries (no `clerkId`, contact fields present); reject without reasons → 422; `other` without note → 422; accept-all confirms everything pending and reprojects once; admin request close; edit of a denied credential or project → `pending`; profile edit on a rejected account → `pending`; `lastDecision` on `/api/me/*`; showcase status filter; migration `0005`.
- Web RTL: People list filters and first-name fallback; builder summary sections; deny dialog (needs a reason, `other` needs a note); accept-all; founder summary with Close request; Showcase list Remove / Restore / Withdrawn read-only; builder sees reasons on `/profile`; landing Showcase section (6 cards, hidden when empty); drawer opens, traps focus, closes on Escape.
- Playwright (Clerk suite): admin opens a builder from People, denies a credential with a reason, the builder sees the reason, edits it, admin accepts it; admin accepts a Showcase entry and it appears on `/`; existing admin specs move to the People tab.

## Acceptance

1. CI green on the PR, including the Clerk Playwright suite.
2. `git grep -n "clerkId" -- apps/web/src/features/admin` prints nothing, and no admin response schema contains `clerkId`.
3. On production after deploy: the admin denies a test item with a reason and the builder account sees it; an accepted Showcase entry appears in the landing section within one reload.

## Out of scope

Email or push notifications; deleting accounts; a permanent ban; bulk actions across several people; a featured flag for the landing section.
