"""The founder's dashboard (Sprint 004, spec #52 §Dashboard response, #66): one call whose
numbers come from SQL, never from the engine (D-17). Tiles map one-to-one onto `counts`;
`requests` are the founder's requests with their route snapshot, newest first; `bidsReceived`
the bids on them from currently confirmed builders, newest first, capped at ten;
`upcomingBookings` the founder's bookings with a start at or after now, soonest first.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.bids import bid_out
from app.api.bookings import booking_out
from app.api.deps import Clock, get_clock
from app.api.requests import request_out
from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.schemas import Dashboard, DashboardCounts, RouteCounts

router = APIRouter(prefix="/api/me", dependencies=[Depends(require_role("founder"))])

BIDS_RECEIVED_CAP = 10


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(
    user: Annotated[CurrentUser, Depends(require_role("founder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> Dashboard:
    assert user.db_user is not None
    founder = user.db_user
    counts = await repo.dashboard_counts(session, founder.id)
    return Dashboard(
        counts=DashboardCounts(
            briefs=counts["briefs"],
            routes=RouteCounts(**counts["routes"]),
            open_requests=counts["open_requests"],
            bids_received=counts["bids_received"],
            bookings=counts["bookings"],
        ),
        requests=[
            request_out(row, owner)
            for row, owner in await repo.requests_for_founder(session, founder.id)
        ],
        bids_received=[
            bid_out(row, request, profile)
            for row, request, profile in await repo.bids_received(
                session, founder.id, BIDS_RECEIVED_CAP
            )
        ],
        upcoming_bookings=[
            booking_out(row, profile, owner, request)
            for row, profile, owner, request in await repo.upcoming_bookings(
                session, founder.id, clock()
            )
        ],
    )
