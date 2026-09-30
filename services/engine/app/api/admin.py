"""Admin routes under /api/admin/* (spec #35 §Admin). Router-level guard: admin.

Confirm and reject set the target's status, append one confirmations row, commit, then call
`reproject()` in the same request (D-15) and answer `{id, kind, status, projectedRows}`.
`GET /decided` lists the confirmed and rejected rows with their latest decision so an admin can
reverse one through the opposite endpoint (spec #35 story 24, #49).

Sprint 005a (#103) adds the `showcase` kind: a Showcase entry is reviewed on its own
`showcase_status`, independent of the project's `status`. Confirm stamps `showcase_confirmed_at`,
reject clears it; both log a `confirmations` row of kind `showcase` and reproject once, because a
visible entry is projected as the display fact `(showcases b p)` (D-52). An entry the builder has
withdrawn answers 409.
"""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import Clock, get_clock
from app.auth.clerk import CurrentUser, require_role
from app.db.session import get_session
from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import reproject
from app.marketplace import repo
from app.marketplace.links import LinkError, youtube_video_id
from app.marketplace.models import Credential, Profile, Project, User
from app.marketplace.schemas import (
    AdminDecision,
    DecidedAccount,
    DecidedCredential,
    DecidedProject,
    DecidedQueue,
    DecidedShowcase,
    PendingAccount,
    PendingCredential,
    PendingProject,
    PendingQueue,
    PendingShowcase,
)

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_role("admin"))])

Kind = Literal["account", "credential", "project", "showcase"]
WITHDRAWN = "Builder has withdrawn this entry"


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
        "issued_on": row.issued_on,
        "credential_url": row.credential_url,
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


def _pitch_video_id(url: str | None) -> str | None:
    if url is None:
        return None
    try:
        return youtube_video_id(url, field="pitchVideoUrl")
    except LinkError:
        return None


def _showcase(row: Project, profile: Profile, owner: User, skills: list[str]) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "builder_id": profile.builder_id,
        "display_name": profile.display_name,
        "cohort_id": profile.cohort_id,
        "title": row.title,
        "description": row.description,
        "vertical": row.vertical,
        "licensable": row.licensable,
        "skill_ids": skills,
        "live_url": row.live_url,
        "demo_url": row.demo_url,
        "pitch_video_url": row.pitch_video_url,
        "pitch_deck_url": row.pitch_deck_url,
        "pitch_video_id": _pitch_video_id(row.pitch_video_url),
        "showcase_status": row.showcase_status,
        "project_status": row.status,
        "account_confirmed": owner.status == "confirmed",
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
    showcase = [
        PendingShowcase(**_showcase(row, profile, owner, skills))
        for row, profile, owner, skills in await repo.pending_showcase(session)
    ]
    return PendingQueue(
        accounts=accounts, credentials=credentials, projects=projects, showcase=showcase
    )


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
    showcase = [
        DecidedShowcase(
            **_showcase(row, profile, owner, skills), status=row.showcase_status, decided_at=at
        )
        for row, profile, owner, skills, at in await repo.decided_showcase(session)
    ]
    return DecidedQueue(
        accounts=accounts, credentials=credentials, projects=projects, showcase=showcase
    )


async def _decide(
    request: Request,
    session: AsyncSession,
    engine: MettaRouteEngine,
    admin: CurrentUser,
    kind: Kind,
    target_id: UUID,
    decision: Literal["confirmed", "rejected"],
    now: datetime,
) -> AdminDecision:
    assert admin.db_user is not None
    if kind == "showcase":
        outcome = await repo.decide_showcase(session, target_id, decision, admin.db_user.id, now)
        if outcome == "withdrawn":
            raise HTTPException(status_code=409, detail=WITHDRAWN)
        found = outcome == "decided"
    else:
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
    clock: Annotated[Clock, Depends(get_clock)],
) -> AdminDecision:
    return await _decide(request, session, engine, admin, kind, target_id, "confirmed", clock())


@router.post("/reject/{kind}/{target_id}", response_model=AdminDecision)
async def reject(
    request: Request,
    kind: Kind,
    target_id: UUID,
    admin: Annotated[CurrentUser, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    engine: Annotated[MettaRouteEngine, Depends(_engine)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> AdminDecision:
    return await _decide(request, session, engine, admin, kind, target_id, "rejected", clock())
