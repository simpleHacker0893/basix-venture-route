"""Admin routes under /api/admin/* (spec #35 §Admin). Router-level guard: admin.

Confirm and reject set the target's status, append one confirmations row, commit, then call
`reproject()` in the same request (D-15) and answer `{id, kind, status, projectedRows}`.
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import reproject
from app.marketplace import repo
from app.marketplace.schemas import (
    AdminDecision,
    PendingAccount,
    PendingCredential,
    PendingProject,
    PendingQueue,
)

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_role("admin"))])

Kind = Literal["account", "credential", "project"]


def _engine(request: Request) -> MettaRouteEngine:
    engine: MettaRouteEngine = request.app.state.engine
    return engine


@router.get("/pending", response_model=PendingQueue)
async def pending(session: Annotated[AsyncSession, Depends(get_session)]) -> PendingQueue:
    accounts = [
        PendingAccount(
            id=str(user.id),
            clerk_id=user.clerk_id,
            email=user.email,
            role=user.role,
            builder_id=profile.builder_id if profile else None,
            display_name=profile.display_name if profile else None,
            cohort_id=profile.cohort_id if profile else None,
            submitted_at=user.created_at,
            demo_data=user.demo_data,
        )
        for user, profile in await repo.pending_accounts(session)
    ]
    credentials = [
        PendingCredential(
            id=str(row.id),
            builder_id=profile.builder_id,
            display_name=profile.display_name,
            title=row.title,
            issuer=row.issuer,
            skill_id=row.skill_id,
            submitted_at=row.created_at,
            demo_data=row.demo_data,
        )
        for row, profile in await repo.pending_credentials(session)
    ]
    projects = [
        PendingProject(
            id=str(row.id),
            builder_id=profile.builder_id,
            display_name=profile.display_name,
            title=row.title,
            vertical=row.vertical,
            licensable=row.licensable,
            completed_on=row.completed_on,
            skill_ids=skills,
            submitted_at=row.created_at,
            demo_data=row.demo_data,
        )
        for row, profile, skills in await repo.pending_projects(session)
    ]
    return PendingQueue(accounts=accounts, credentials=credentials, projects=projects)


async def _decide(
    request: Request,
    session: AsyncSession,
    engine: MettaRouteEngine,
    admin: CurrentUser,
    kind: Kind,
    target_id: UUID,
    decision: Literal["confirmed", "rejected"],
) -> AdminDecision:
    assert admin.db_user is not None
    found = await repo.decide(session, kind, target_id, decision, admin.db_user.id)
    if not found:
        raise HTTPException(status_code=404, detail=f"no pending {kind} {target_id}")
    projected = await reproject(engine, session)
    request.app.state.known_entities = engine.known_entities()
    return AdminDecision(id=str(target_id), kind=kind, status=decision, projected_rows=projected)


@router.post("/confirm/{kind}/{target_id}", response_model=AdminDecision)
async def confirm(
    request: Request,
    kind: Kind,
    target_id: UUID,
    admin: Annotated[CurrentUser, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    engine: Annotated[MettaRouteEngine, Depends(_engine)],
) -> AdminDecision:
    return await _decide(request, session, engine, admin, kind, target_id, "confirmed")


@router.post("/reject/{kind}/{target_id}", response_model=AdminDecision)
async def reject(
    request: Request,
    kind: Kind,
    target_id: UUID,
    admin: Annotated[CurrentUser, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    engine: Annotated[MettaRouteEngine, Depends(_engine)],
) -> AdminDecision:
    return await _decide(request, session, engine, admin, kind, target_id, "rejected")
