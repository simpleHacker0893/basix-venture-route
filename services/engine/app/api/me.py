"""Builder routes under /api/me/* (spec #35 §Marketplace API).

Router-level guard: builder. The one exception is `POST /api/me/role`, which any verified
session may call once, before its users row exists (the webhook may not have arrived yet).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import CurrentUser, current_user, require_role
from app.auth.webhook import ClerkAdmin
from app.db.session import get_session
from app.engine.metta_engine import MettaRouteEngine
from app.marketplace import repo
from app.marketplace.models import Credential, Profile, Project, User
from app.marketplace.schemas import (
    AvailabilityRange,
    BuilderProfile,
    Contact,
    ContactSharing,
    CredentialInput,
    CredentialOut,
    DeliveryModes,
    ProfileInput,
    ProjectInput,
    ProjectOut,
    RoleChoice,
    RoleResponse,
)
from app.marketplace.verification import profile_skills

router = APIRouter(prefix="/api/me")
builder_router = APIRouter(dependencies=[Depends(require_role("builder"))])

PENDING_EMAIL_DOMAIN = "pending.clerk.invalid"


def _engine(request: Request) -> MettaRouteEngine:
    engine: MettaRouteEngine = request.app.state.engine
    return engine


def _clerk_admin(request: Request) -> ClerkAdmin:
    admin: ClerkAdmin = request.app.state.clerk_admin
    return admin


# -- POST /api/me/role: chosen once, written to Clerk publicMetadata (D-03) ------------------------


@router.post("/role", response_model=RoleResponse)
async def choose_role(
    choice: RoleChoice,
    user: Annotated[CurrentUser, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    clerk_admin: Annotated[ClerkAdmin, Depends(_clerk_admin)],
) -> RoleResponse:
    row = user.db_user
    if row is not None and row.role is not None:
        raise HTTPException(status_code=409, detail="role already chosen")
    # Clerk first, commit after: if the publicMetadata write fails nothing is stored locally, so
    # the retry is not a 409 and the session claim can never lag a committed role.
    try:
        await clerk_admin.set_role(user.clerk_id, choice.role)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="clerk backend unavailable") from exc
    if row is None:
        # The webhook has not created the row yet; it will overwrite this email when it arrives.
        row = User(clerk_id=user.clerk_id, email=f"{user.clerk_id}@{PENDING_EMAIL_DOMAIN}")
        session.add(row)
    row.role = choice.role
    await session.commit()
    return RoleResponse(
        clerk_id=row.clerk_id, role=choice.role, confirmed=row.status == "confirmed"
    )


# -- GET / PUT /api/me/profile ---------------------------------------------------------------------


async def _render(session: AsyncSession, user: User, profile: Profile) -> BuilderProfile:
    rows = await repo.confirmed_rows_for(session, profile.id)
    names = await repo.skill_names(session)
    availability = await repo.availability_for(session, profile.id)
    return BuilderProfile(
        builder_id=profile.builder_id,
        display_name=profile.display_name,
        headline=profile.headline,
        cohort_id=profile.cohort_id,
        location=profile.location,
        day_rate=profile.day_rate,
        modes=DeliveryModes(
            remote=profile.supports_remote,
            hybrid=profile.supports_hybrid,
            on_site=profile.supports_onsite,
        ),
        self_described_skills=list(profile.self_described_skills),
        contact=Contact(email=user.email, phone=profile.phone, linkedin=profile.linkedin),
        sharing=ContactSharing(
            email=profile.share_email, phone=profile.share_phone, linkedin=profile.share_linkedin
        ),
        availability=[
            AvailabilityRange(start=row.start_date, end=row.end_date) for row in availability
        ],
        skills=profile_skills(rows, list(profile.self_described_skills), names),
        account_status=user.status,
        confirmed=user.status == "confirmed",
        demo_data=profile.demo_data,
    )


@builder_router.get("/profile", response_model=BuilderProfile)
async def get_profile(
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BuilderProfile:
    assert user.db_user is not None  # require_role guarantees the row
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no profile yet")
    return await _render(session, user.db_user, profile)


@builder_router.put("/profile", response_model=BuilderProfile)
async def put_profile(
    body: ProfileInput,
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    engine: Annotated[MettaRouteEngine, Depends(_engine)],
) -> BuilderProfile:
    assert user.db_user is not None
    if body.cohort_id is not None and body.cohort_id not in engine.cohorts():
        raise RequestValidationError(
            [{"loc": ("body", "cohortId"), "msg": "unknown cohort", "type": "value_error"}]
        )
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        builder_id = await repo.allocate_builder_id(
            session, body.display_name, engine.known_entities() | engine.known_locations()
        )
        profile = Profile(
            user_id=user.db_user.id,
            builder_id=builder_id,
            display_name=body.display_name,
            location=body.location,
            day_rate=body.day_rate,
        )
        session.add(profile)
    profile.display_name = body.display_name
    profile.headline = body.headline
    profile.cohort_id = body.cohort_id
    profile.location = body.location
    profile.day_rate = body.day_rate
    profile.supports_remote = body.modes.remote
    profile.supports_hybrid = body.modes.hybrid
    profile.supports_onsite = body.modes.on_site
    profile.self_described_skills = list(dict.fromkeys(body.self_described_skills))
    profile.phone = body.phone
    profile.linkedin = body.linkedin
    profile.share_email = body.sharing.email
    profile.share_phone = body.sharing.phone
    profile.share_linkedin = body.sharing.linkedin
    await session.flush()
    await repo.replace_availability(
        session, profile.id, [(item.start, item.end) for item in body.availability]
    )
    await session.commit()
    await session.refresh(profile)
    return await _render(session, user.db_user, profile)


# -- credentials and projects: proof, pending until an admin confirms it (#42) -------------------


async def _own_profile(session: AsyncSession, user: CurrentUser) -> Profile:
    assert user.db_user is not None
    profile = await repo.profile_for_user(session, user.db_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no profile yet")
    return profile


def _credential_out(row: Credential) -> CredentialOut:
    return CredentialOut(
        id=str(row.id),
        title=row.title,
        issuer=row.issuer,
        skill_id=row.skill_id,
        status=row.status,
        demo_data=row.demo_data,
    )


def _project_out(row: Project, skill_ids: list[str]) -> ProjectOut:
    return ProjectOut(
        id=str(row.id),
        title=row.title,
        vertical=row.vertical,
        licensable=row.licensable,
        completed_on=row.completed_on,
        skill_ids=skill_ids,
        status=row.status,
        demo_data=row.demo_data,
    )


@builder_router.get("/credentials", response_model=list[CredentialOut])
async def list_credentials(
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CredentialOut]:
    profile = await _own_profile(session, user)
    return [_credential_out(row) for row in await repo.credentials_for(session, profile.id)]


@builder_router.post("/credentials", response_model=CredentialOut, status_code=201)
async def create_credential(
    body: CredentialInput,
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CredentialOut:
    profile = await _own_profile(session, user)
    row = await repo.add_credential(
        session, profile.id, title=body.title, issuer=body.issuer, skill_id=body.skill_id
    )
    return _credential_out(row)


@builder_router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectOut]:
    profile = await _own_profile(session, user)
    return [
        _project_out(row, skills) for row, skills in await repo.projects_for(session, profile.id)
    ]


@builder_router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectInput,
    user: Annotated[CurrentUser, Depends(require_role("builder"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectOut:
    profile = await _own_profile(session, user)
    row = await repo.add_project(
        session,
        profile.id,
        title=body.title,
        vertical=body.vertical,
        licensable=body.licensable,
        completed_on=body.completed_on,
        skill_ids=body.skill_ids,
    )
    return _project_out(row, list(dict.fromkeys(body.skill_ids)))


router.include_router(builder_router)
