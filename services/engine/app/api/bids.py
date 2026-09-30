"""Bids (Sprint 004, spec #52 §HTTP API, #62): `POST /api/requests/{id}/bids`.

The gate: a builder bids on an open request only when the engine says `eligible-builder` holds
for them on the request's brief (DOMAIN.md §Marketplace rules, AGENTS.md rule 1). The request
row is selected FOR UPDATE, checked open (409), the route service computes eligibility in a
worker thread, an ineligible builder is refused with 403 and `detail` equal to the engine's
reason, and the bid is inserted with the engine's skills and path; the UNIQUE on (request,
profile) turns a duplicate or a race into 409. Nothing here becomes an atom (D-15).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_route_service
from app.api.requests import eligibility_for, owned_or_visible
from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.models import Bid, Profile
from app.marketplace.models import Request as RequestRow
from app.marketplace.schemas import BidCreate, BidOut
from app.models.engine import ReasoningPath
from app.routing.route_service import RouteService

router = APIRouter(dependencies=[Depends(require_role("founder", "builder"))])


def bid_out(row: Bid, request: RequestRow, profile: Profile) -> BidOut:
    return BidOut(
        id=str(row.id),
        request_id=str(request.id),
        request_title=request.title,
        request_status=request.status,
        builder_id=profile.builder_id,
        display_name=profile.display_name,
        day_rate=row.day_rate,
        message=row.message,
        eligible_skills=list(row.eligible_skills),
        path=ReasoningPath.model_validate(row.path),
        status=row.status,
        created_at=row.created_at,
        demo_data=row.demo_data,
    )


@router.post("/api/requests/{request_id}/bids", response_model=BidOut, status_code=201)
async def submit_bid(
    request_id: UUID,
    body: BidCreate,
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    service: Annotated[RouteService, Depends(get_route_service)],
) -> BidOut:
    assert user.db_user is not None
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no profile yet")
    request = await repo.request_for_update(session, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail=f"no request {request_id}")
    if request.status != "open":
        raise HTTPException(status_code=409, detail="request closed")
    verdict = await eligibility_for(service, request, profile.builder_id)
    if not verdict.eligible or verdict.path is None:
        raise HTTPException(status_code=403, detail=verdict.reason)
    row = await repo.add_bid(
        session,
        request,
        profile,
        day_rate=body.day_rate,
        message=body.message,
        eligible_skills=verdict.skills,
        path=verdict.path.model_dump(mode="json", by_alias=True),
    )
    if row is None:
        raise HTTPException(status_code=409, detail="already bid")
    return bid_out(row, request, profile)


@router.get("/api/requests/{request_id}/bids", response_model=list[BidOut])
async def bids_on_request(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("founder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BidOut]:
    """The owning founder's view: bids from builders whose account is confirmed right now,
    newest first (#63). A bid from a builder un-confirmed since is hidden, not deleted."""
    request, _founder = await owned_or_visible(session, user, request_id)
    return [
        bid_out(row, request, profile)
        for row, profile in await repo.bids_for_request(session, request)
    ]


@router.get("/api/me/bids", response_model=list[BidOut])
async def my_bids(
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BidOut]:
    """The builder's own bids with each request's title and status, newest first (#63)."""
    assert user.db_user is not None
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no profile yet")
    return [
        bid_out(row, request, profile)
        for row, request in await repo.bids_for_profile(session, profile)
    ]
