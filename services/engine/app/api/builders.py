"""Candidate view under /api/builders/* (spec #35 §Marketplace API, ticket #43).

Router-level guard: founder or admin. A builder is visible only once an admin confirmed the
account (DOMAIN.md §Marketplace rules); anything else, including seed builder ids that have no
users row, answers 404. Proof is shown only when confirmed, from the same rows the projection
reads, and the `contact` block carries only the keys whose sharing toggle is on, never nulls.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import require_role
from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.schemas import (
    AvailabilityRange,
    Candidate,
    DeliveryModes,
    ProjectOut,
    SharedContact,
)
from app.marketplace.verification import profile_skills

router = APIRouter(prefix="/api/builders", dependencies=[Depends(require_role("founder", "admin"))])


@router.get("/{builder_id}", response_model=Candidate)
async def candidate(
    builder_id: str, session: Annotated[AsyncSession, Depends(get_session)]
) -> Candidate:
    found = await repo.confirmed_profile_by_builder_id(session, builder_id)
    if found is None:
        raise HTTPException(status_code=404, detail=f"no confirmed builder {builder_id}")
    profile, user = found
    rows = await repo.confirmed_rows_for(session, profile.id)
    names = await repo.skill_names(session)
    availability = await repo.availability_for(session, profile.id)
    projects = [
        ProjectOut(
            id=str(row.id),
            title=row.title,
            vertical=row.vertical,
            licensable=row.licensable,
            completed_on=row.completed_on,
            skill_ids=skill_ids,
            status=row.status,
            demo_data=row.demo_data,
        )
        for row, skill_ids in await repo.projects_for(session, profile.id)
        if row.status == "confirmed"
    ]
    return Candidate(
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
        availability=[
            AvailabilityRange(start=row.start_date, end=row.end_date) for row in availability
        ],
        skills=profile_skills(rows, list(profile.self_described_skills), names),
        projects=projects,
        contact=SharedContact(
            email=user.email if profile.share_email else None,
            phone=profile.phone if profile.share_phone else None,
            linkedin=profile.linkedin if profile.share_linkedin else None,
        ),
        confirmed=True,
        demo_data=profile.demo_data,
    )
