"""Requests under /api/requests (Sprint 004, spec #52 §HTTP API, #59).

A founder publishes the brief and the route snapshot they just saw; the engine validates the
brief as a `VentureBrief` (422, field-mapped) and stores the JSONB snapshot with the promoted
columns. The route snapshot is display-only: eligibility is always recomputed by the engine and
never read from it. Founders see their own requests in every status; builders see every open one.
A request that is not the founder's answers 404 so ids leak nothing. Admins are not granted
access this sprint.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_route_service
from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.models import Request as RequestRow
from app.marketplace.models import User
from app.marketplace.schemas import Eligibility, RequestCreate, RequestOut, RouteSnapshot
from app.models.brief import VentureBrief
from app.routing.route_service import RouteService

router = APIRouter(
    prefix="/api/requests", dependencies=[Depends(require_role("founder", "builder"))]
)


def request_out(
    row: RequestRow, founder: User, eligibility: Eligibility | None = None
) -> RequestOut:
    return RequestOut(
        id=str(row.id),
        founder_id=founder.clerk_id,
        brief=VentureBrief.model_validate(row.brief),
        route=RouteSnapshot.model_validate(row.route),
        title=row.title,
        vertical=row.vertical,
        delivery_mode=row.delivery_mode,
        availability_start=row.availability_start,
        availability_end=row.availability_end,
        daily_budget=row.daily_budget,
        route_status=row.route_status,
        status=row.status,
        closed_at=row.closed_at,
        created_at=row.created_at,
        eligibility=eligibility,
        demo_data=row.demo_data,
    )


async def owned_or_visible(
    session: AsyncSession, user: CurrentUser, request_id: UUID
) -> tuple[RequestRow, User]:
    """The request for its founder or for any builder; 404 for everyone else."""
    assert user.db_user is not None
    found = await repo.request_by_id(session, request_id)
    if found is None or (user.role == "founder" and found[0].founder_id != user.db_user.id):
        raise HTTPException(status_code=404, detail=f"no request {request_id}")
    return found


@router.post("", response_model=RequestOut, status_code=201)
async def publish(
    body: RequestCreate,
    user: Annotated[CurrentUser, Depends(require_role("founder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RequestOut:
    assert user.db_user is not None
    brief = body.brief
    row = await repo.create_request(
        session,
        user.db_user,
        brief=brief.model_dump(mode="json", by_alias=True),
        route=body.route.model_dump(mode="json", by_alias=True),
        title=brief.title,
        vertical=brief.vertical,
        delivery_mode=brief.delivery_mode,
        availability_start=brief.availability_start,
        availability_end=brief.availability_end,
        daily_budget=brief.daily_budget,
        route_status=body.route.status,
    )
    return request_out(row, user.db_user)


async def _builder_slug(session: AsyncSession, user: CurrentUser) -> str:
    """The signed-in builder's profile slug, the symbol the projection renders (#56)."""
    assert user.db_user is not None
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no profile yet")
    return profile.builder_id


async def eligibility_for(service: RouteService, row: RequestRow, builder_id: str) -> Eligibility:
    """The engine's verdict for one builder on the request's brief, computed in a worker thread
    under the engine lock like routing; never read from the stored route snapshot."""
    brief = VentureBrief.model_validate(row.brief)
    verdict = await run_in_threadpool(service.eligibility, brief, builder_id)
    return Eligibility(
        eligible=verdict.eligible,
        skills=verdict.skills,
        path=verdict.path,
        reason=verdict.reason,
    )


@router.get("", response_model=list[RequestOut])
async def list_requests(
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    service: Annotated[RouteService, Depends(get_route_service)],
) -> list[RequestOut]:
    assert user.db_user is not None
    if user.role == "founder":
        rows = await repo.requests_for_founder(session, user.db_user.id)
        return [request_out(row, founder) for row, founder in rows]
    builder_id = await _builder_slug(session, user)
    return [
        request_out(row, founder, await eligibility_for(service, row, builder_id))
        for row, founder in await repo.open_requests(session)
    ]


@router.get("/{request_id}/eligibility", response_model=Eligibility)
async def eligibility_for_me(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    service: Annotated[RouteService, Depends(get_route_service)],
) -> Eligibility:
    row, _founder = await owned_or_visible(session, user, request_id)
    return await eligibility_for(service, row, await _builder_slug(session, user))


@router.get("/{request_id}", response_model=RequestOut)
async def read_request(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("founder", "builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RequestOut:
    row, founder = await owned_or_visible(session, user, request_id)
    return request_out(row, founder)


@router.post("/{request_id}/close", response_model=RequestOut)
async def close_request(
    request_id: UUID,
    user: Annotated[CurrentUser, Depends(require_role("founder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RequestOut:
    """The owning founder closes the request: no further bids (#62 answers 409) and it leaves
    the builders' board; it stays in the founder's list with its status."""
    row, founder = await owned_or_visible(session, user, request_id)
    if row.status == "closed":
        raise HTTPException(status_code=409, detail="request already closed")
    row = await repo.close_request(session, row, datetime.now(UTC))
    return request_out(row, founder)
