"""Bookings (Sprint 004, spec #52 §HTTP API, #64): `POST /api/bookings`, `GET /api/me/bookings`.

A founder proposes an interview slot to a confirmed builder. The slot follows the Operator's
rules through `slots.valid_slot` (inside the builder's confirmed availability, on the 30-minute
grid 08:00 to 18:00 Africa/Nairobi, 30 or 45 minutes; a violation is a field-mapped 422). The
row is written in state `proposed` with the first history entry from the pure machine
(`booking.start`). Times are stored in UTC and every BookingOut carries `proposedStartLocal`
rendered in Africa/Nairobi by `slots.to_nairobi`, so the web does no zone arithmetic (D-16).
"""

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.booking import IllegalTransition, Proposal, start, transition
from app.marketplace.models import Booking, Profile, User
from app.marketplace.models import Request as RequestRow
from app.marketplace.schemas import (
    BookingCreate,
    BookingHistoryEntry,
    BookingOut,
    BookingProposal,
)
from app.marketplace.slots import to_nairobi, valid_slot

router = APIRouter(dependencies=[Depends(require_role("founder", "builder"))])


def _entry_out(entry: dict[str, Any]) -> BookingHistoryEntry:
    proposed_start = datetime.fromisoformat(str(entry["proposedStart"]))
    return BookingHistoryEntry(
        action=entry["action"],
        actor=entry["actor"],
        state=entry["state"],
        proposed_start=proposed_start,
        proposed_start_local=to_nairobi(proposed_start),
        duration_min=entry["durationMin"],
        note=str(entry.get("note", "")),
        at=datetime.fromisoformat(str(entry["at"])),
    )


def booking_out(
    row: Booking, profile: Profile, founder: User, request: RequestRow | None
) -> BookingOut:
    return BookingOut(
        id=str(row.id),
        request_id=None if request is None else str(request.id),
        request_title=None if request is None else request.title,
        founder_id=founder.clerk_id,
        builder_id=profile.builder_id,
        display_name=profile.display_name,
        state=row.state,
        proposed_start=row.proposed_start,
        proposed_start_local=to_nairobi(row.proposed_start),
        duration_min=row.duration_min,
        note=row.note,
        history=[_entry_out(entry) for entry in row.history],
        created_at=row.created_at,
        demo_data=row.demo_data,
    )


def _slot_error(field: str, reason: str) -> RequestValidationError:
    return RequestValidationError([{"loc": ("body", field), "msg": reason, "type": "value_error"}])


async def validated_proposal(
    session: AsyncSession, profile: Profile, proposed_start: datetime, duration_min: int, note: str
) -> Proposal:
    """The proposal in UTC once the slot rules hold for this builder; 422 otherwise."""
    start_utc = proposed_start.astimezone(UTC)
    ranges = [
        (row.start_date, row.end_date) for row in await repo.availability_for(session, profile.id)
    ]
    reason = valid_slot(start_utc, duration_min, ranges)
    if reason is not None:
        raise _slot_error("proposedStart", reason)
    return Proposal(start=start_utc, duration_min=duration_min, note=note)


@router.post("/api/bookings", response_model=BookingOut, status_code=201)
async def create_booking(
    body: BookingCreate,
    user: Annotated[CurrentUser, Depends(require_role("founder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BookingOut:
    assert user.db_user is not None
    found = await repo.confirmed_profile_by_builder_id(session, body.builder_id)
    if found is None:
        raise HTTPException(status_code=404, detail=f"no confirmed builder {body.builder_id}")
    profile, _builder_user = found
    request: RequestRow | None = None
    if body.request_id is not None:
        try:
            request_id = UUID(body.request_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=f"no request {body.request_id}") from exc
        owned = await repo.request_by_id(session, request_id)
        if owned is None or owned[0].founder_id != user.db_user.id:
            raise HTTPException(status_code=404, detail=f"no request {body.request_id}")
        request = owned[0]
    proposal = await validated_proposal(
        session, profile, body.proposed_start, body.duration_min, body.note
    )
    state, history = start(proposal, datetime.now(UTC))
    row = await repo.add_booking(
        session,
        user.db_user,
        profile,
        request,
        proposed_start=proposal.start,
        duration_min=proposal.duration_min,
        note=proposal.note,
        state=state,
        history=history,
    )
    return booking_out(row, profile, user.db_user, request)


# -- transitions (#65): accept (builder), counter (either party), confirm (founder) -------------


async def _party_booking(session: AsyncSession, user: CurrentUser, booking_id: UUID) -> Booking:
    """The locked booking row for one of its two parties; 404 for anyone else."""
    assert user.db_user is not None
    row = await repo.booking_for_update(session, booking_id)
    if row is not None:
        if user.role == "founder" and row.founder_id == user.db_user.id:
            return row
        if user.role == "builder":
            profile = await repo.profile_for_user(session, user.db_user.id)
            if profile is not None and profile.id == row.profile_id:
                return row
    raise HTTPException(status_code=404, detail=f"no booking {booking_id}")


async def _transition(
    session: AsyncSession,
    user: CurrentUser,
    booking_id: UUID,
    action: str,
    proposal_body: BookingProposal | None,
) -> BookingOut:
    """Lock the row, apply the pure machine, map IllegalTransition to 409, write state and
    history together, commit, and answer the re-read row."""
    row = await _party_booking(session, user, booking_id)
    actor = str(user.role)
    proposal: Proposal | None = None
    if proposal_body is not None:
        profile = await session.get(Profile, row.profile_id)
        assert profile is not None  # the FK holds
        proposal = await validated_proposal(
            session,
            profile,
            proposal_body.proposed_start,
            proposal_body.duration_min,
            proposal_body.note,
        )
    try:
        state, history = transition(
            row.state, list(row.history), action, actor, proposal, datetime.now(UTC)
        )
    except IllegalTransition as exc:
        raise HTTPException(status_code=409, detail=exc.reason) from exc
    latest = history[-1]
    await repo.apply_transition(
        session,
        row,
        state=state,
        history=history,
        proposed_start=datetime.fromisoformat(str(latest["proposedStart"])),
        duration_min=int(latest["durationMin"]),
        note=str(latest.get("note", "")),
    )
    found = await repo.booking_by_id(session, row.id)
    assert found is not None
    booking, profile, founder, request = found
    return booking_out(booking, profile, founder, request)


@router.post("/api/bookings/{booking_id}/accept", response_model=BookingOut)
async def accept_booking(
    booking_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BookingOut:
    """Both parties may call; the machine refuses a founder's accept with 409 (spec #52)."""
    return await _transition(session, user, booking_id, "accept", None)


@router.post("/api/bookings/{booking_id}/counter", response_model=BookingOut)
async def counter_booking(
    booking_id: UUID,
    body: BookingProposal,
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BookingOut:
    return await _transition(session, user, booking_id, "counter", body)


@router.post("/api/bookings/{booking_id}/confirm", response_model=BookingOut)
async def confirm_booking(
    booking_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BookingOut:
    """Both parties may call; the machine refuses a builder's confirm with 409 (spec #52)."""
    return await _transition(session, user, booking_id, "confirm", None)


@router.get("/api/me/bookings", response_model=list[BookingOut])
async def my_bookings(
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BookingOut]:
    """Own bookings, upcoming first, for the founder or the builder party."""
    assert user.db_user is not None
    if user.role == "founder":
        rows = await repo.bookings_for_founder(session, user.db_user.id)
    else:
        profile = await repo.profile_for_user(session, user.db_user.id)
        rows = [] if profile is None else await repo.bookings_for_profile(session, profile.id)
    return [booking_out(row, profile, founder, request) for row, profile, founder, request in rows]
