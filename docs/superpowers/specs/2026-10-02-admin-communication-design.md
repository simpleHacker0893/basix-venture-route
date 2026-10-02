# Sprint 009: Admin communication (D-61)

Brainstormed and approved with the Operator on 2026-10-02. Depends on Sprint 008 (the admin console's tabs, the reason codes and migration `0005`).

## Goal

The admin can see and support every contact between founders and builders: every bid message and every interview booking, in one place. Normal bookings and messages go through without waiting for anyone ("approved automatically"); the admin can step in afterwards. When the admin arranges an interview, it is confirmed at once ("auto accepted").

## Approval model (D-61)

- **Post-moderation.** Bids, bid messages and bookings between founders and builders take effect immediately, exactly as today (D-44). Nothing waits for an admin.
- **The admin steps in afterwards** with two actions, each needing a reason from the Sprint 008 list:
  - **Cancel a booking** → new terminal state `cancelled`.
  - **Hide a bid message** → the founder no longer sees the message text; the bid itself stays.
- **Admin-arranged interviews are confirmed at once.** A booking created by an admin starts in `confirmed`. Either side can still ask for a new time (below).

## Booking state machine changes (amends D-44)

`services/engine/app/marketplace/booking.py` stays the pure `start` / `check` / `transition` machine.

| Change | Rule |
|---|---|
| New state `cancelled` | Terminal. Reached from any non-terminal state **and** from `confirmed` by the actor `admin` with action `cancel`. No other actor can cancel in this sprint. |
| Admin start | `start_by_admin(proposal, now)` → `("confirmed", [entry("arrange", "admin", "confirmed", …)])` |
| New time on an admin-arranged booking | From `confirmed`, when the history's first entry is `arrange` by `admin`: the builder may `counter` → `countered` (the founder then confirms or counters), and the founder may `counter` → `proposed` (the builder then accepts or counters). Both re-enter the normal D-44 rounds. Founder-proposed bookings keep `confirmed` terminal for founders and builders. |
| Every other cell | 409 with the reason, as today |

`BOOKING_STATES` and the `ck_bookings_state` check gain `cancelled`.

## Who the admin can book

The admin picks a founder's **open** request and a builder. The builder must be **eligible** for that request by the engine's verdict (`GET /api/requests/{id}/eligibility`, D-45): the same rule as bidding. An ineligible builder answers 403 with the engine's reason. Eligibility stays with MeTTa (AGENTS.md rule 1); the admin cannot override it.

The slot rules of D-46 (Africa/Nairobi presenter, slot validation) apply unchanged.

## Admin console: Interviews tab

A fourth tab, **Interviews**, beside People, Showcase and History.

- **Bookings list**: every booking with founder first name, builder first name, request title, state, the time on the table (Africa/Nairobi), last change. Filters: state, upcoming / past.
- Booking detail: the full proposal history (who proposed what, when) and **Cancel** (reason dialog).
- **Bid messages list**: every bid with builder first name, request title, the message, sent time, and **Hide message** (reason dialog). Hidden messages show "Hidden by BASIX admin" with the reasons, to admins only.
- **Arrange an interview**: choose an open request, then an eligible builder (the picker lists only eligible builders, from the eligibility endpoint), then a time slot and an optional note. Submitting creates a `confirmed` booking.

## What founders and builders see

- A cancelled booking shows "Cancelled by BASIX" with the reasons and note on `/bookings/:id`, the founder dashboard and the builder's interviews list.
- An admin-arranged booking shows "Arranged by BASIX" and its confirmed time, with **Ask for a new time** for both sides.
- A hidden bid message shows to the founder as "Message hidden by BASIX". The builder sees their own message with "Hidden by BASIX" and the reasons.

## API (engine)

| Method and path | Role | Body | Answers |
|---|---|---|---|
| `GET /api/admin/bookings?state=&when=upcoming\|past` | admin | | `AdminBooking[]` |
| `GET /api/admin/bookings/{id}` | admin | | `AdminBooking` with history |
| `POST /api/admin/bookings` | admin | `{requestId, builderId, slot, note?}` | 201 `BookingOut` in `confirmed`; 403 if the builder is not eligible; 409 if the request is closed |
| `POST /api/admin/bookings/{id}/cancel` | admin | `{reasons, note?}` | `BookingOut` in `cancelled`; 409 if already cancelled |
| `GET /api/admin/bids` | admin | | `AdminBid[]` |
| `POST /api/admin/bids/{id}/hide` | admin | `{reasons, note?}` | `AdminBid` |
| `POST /api/bookings/{id}/counter` | founder, builder | unchanged | now also legal from `confirmed` on an admin-arranged booking |

`BookingOut` gains `arrangedByAdmin: boolean` and `cancellation: {reasons, note, at} | null`. `BidOut` gains `hidden: {reasons, note, at} | null`; for the founder, `message` is empty when hidden.

## Data: migration `0006_admin_communication`

- `bookings.state` check gains `cancelled`; `bookings.arranged_by_admin boolean not null default false`; `bookings.cancel_reasons text[] not null default '{}'`, `bookings.cancel_note text null`.
- `bids.hidden_at timestamptz null`, `bids.hidden_reasons text[] not null default '{}'`, `bids.hidden_note text null`.
- Reason arrays use the Sprint 008 code check.

## Contracts

`AdminBooking`, `AdminBid`, `ArrangeBookingBody`, the cancel and hide bodies, and the extended `BookingOut` / `BidOut` get Zod schemas, Pydantic twins and parity-test entries.

## Tests (seams per D-19)

- Pure machine (`booking.py`): `start_by_admin` → `confirmed`; admin `cancel` from every non-terminal state and from `confirmed`; founder or builder `cancel` → 409; `counter` from `confirmed` legal only on admin-arranged bookings; `cancelled` terminal.
- Engine over HTTP: arrange with an eligible builder → 201 confirmed; ineligible → 403 with the engine reason; closed request → 409; cancel needs a reason; hide needs a reason; the founder's `BidOut.message` is empty when hidden; non-admins get 403 on every `/api/admin/bookings*` and `/api/admin/bids*` route; migration `0006`.
- Web RTL: Interviews tab lists, filters, cancel and hide dialogs, arrange flow (only eligible builders listed); "Cancelled by BASIX" and "Arranged by BASIX" on `/bookings/:id`.
- Playwright (Clerk suite): admin arranges an interview for an eligible builder on an open request; the builder sees it confirmed; the admin cancels it with a reason; the founder sees "Cancelled by BASIX".

## Acceptance

1. CI green on the PR, including the Clerk Playwright suite.
2. The D-44 machine tests still pass unchanged for founder-proposed bookings.
3. On production after deploy: the admin arranges and then cancels a test interview, and both sides see each state.

## Out of scope (recorded as later ideas)

In-app chat between founders and builders; founders or builders cancelling their own bookings; email or calendar invites; admin approval queues for bookings or messages.
