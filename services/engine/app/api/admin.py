"""Admin routes under /api/admin/* (spec #35 §Admin). Router-level guard: admin.

Confirm and reject set the target's status, append one confirmations row, commit, then call
`reproject()` in the same request (D-15) and answer `{id, kind, status, projectedRows}`.
`GET /decided` lists the confirmed and rejected rows with their latest decision so an admin can
reverse one through the opposite endpoint (spec #35 story 24, #49).
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import reproject
from app.marketplace import repo
from app.marketplace.models import Credential, Profile, Project, User
from app.marketplace.schemas import (
    AdminDecision,
    DecidedAccount,
    DecidedCredential,
    DecidedProject,
    DecidedQueue,
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


def _account(user: User, profile: Profile | None) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "clerk_id": user.clerk_id,
        "email": user.email,
        "role": user.role,
        "builder_id": profile.builder_id if profile else None,
        "display_name": profile.display_name if profile else None,
        "cohort_id": profile.cohort_id if profile else None,
        "submitted_at": user.created_at,
        "demo_data": user.demo_data,
    }


def _credential(row: Credential, profile: Profile) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "builder_id": profile.builder_id,
        "display_name": profile.display_name,
        "title": row.title,
        "issuer": row.issuer,
        "skill_id": row.skill_id,
        "submitted_at": row.created_at,
        "demo_data": row.demo_data,
    }


def _project(row: Project, profile: Profile, skills: list[str]) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "builder_id": profile.builder_id,
        "display_name": profile.display_name,
        "title": row.title,
        "vertical": row.vertical,
        "licensable": row.licensable,
        "completed_on": row.completed_on,
        "skill_ids": skills,
        "submitted_at": row.created_at,
        "demo_data": row.demo_data,
    }


@router.get("/pending", response_model=PendingQueue)
async def pending(session: Annotated[AsyncSession, Depends(get_session)]) -> PendingQueue:
    accounts = [
        PendingAccount(**_account(user, profile))
        for user, profile in await repo.pending_accounts(session)
    ]
    credentials = [
        PendingCredential(**_credential(row, profile))
        for row, profile in await repo.pending_credentials(session)
    ]
    projects = [
        PendingProject(**_project(row, profile, skills))
        for row, profile, skills in await repo.pending_projects(session)
    ]
    return PendingQueue(accounts=accounts, credentials=credentials, projects=projects)


@router.get("/decided", response_model=DecidedQueue)
async def decided(session: Annotated[AsyncSession, Depends(get_session)]) -> DecidedQueue:
    """Confirmed and rejected rows with their latest decision, so a mistake can be reversed
    through the opposite decision endpoint (spec #35 story 24, #49). Admin accounts never appear."""
    accounts = [
        DecidedAccount(**_account(user, profile), status=user.status, decided_at=decided_at)
        for user, profile, decided_at in await repo.decided_accounts(session)
    ]
    credentials = [
        DecidedCredential(**_credential(row, profile), status=row.status, decided_at=decided_at)
        for row, profile, decided_at in await repo.decided_credentials(session)
    ]
    projects = [
        DecidedProject(**_project(row, profile, skills), status=row.status, decided_at=decided_at)
        for row, profile, skills, decided_at in await repo.decided_projects(session)
    ]
    return DecidedQueue(accounts=accounts, credentials=credentials, projects=projects)


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
