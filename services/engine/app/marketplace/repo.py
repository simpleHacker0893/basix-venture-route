"""Every marketplace query the API and the projection use (spec #35 §Architecture).

Routes and the projection never write SQL themselves; they call these functions with a session.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date
from uuid import UUID

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import (
    Availability,
    Credential,
    Profile,
    Project,
    ProjectSkill,
    Skill,
    User,
)
from app.marketplace.verification import ConfirmedCredential, ConfirmedProject, ConfirmedRows

_NON_SLUG = re.compile(r"[^a-z0-9]+")


# -- users ----------------------------------------


async def user_by_clerk_id(session: AsyncSession, clerk_id: str) -> User | None:
    return (await session.exec(select(User).where(User.clerk_id == clerk_id))).first()


# -- skills ----------------------------------------


async def skill_names(session: AsyncSession) -> dict[str, str]:
    """Skill id → display name, in the seed order the migration inserted them."""
    rows = (await session.exec(select(Skill).order_by(col(Skill.created_at), col(Skill.id)))).all()
    return {row.id: row.name for row in rows}


# -- profiles ----------------------------------------


async def profile_for_user(session: AsyncSession, user_id: UUID) -> Profile | None:
    return (await session.exec(select(Profile).where(Profile.user_id == user_id))).first()


async def profile_by_builder_id(session: AsyncSession, builder_id: str) -> Profile | None:
    return (await session.exec(select(Profile).where(Profile.builder_id == builder_id))).first()


def slugify(display_name: str) -> str:
    slug = _NON_SLUG.sub("-", display_name.lower()).strip("-")
    return slug or "builder"


async def allocate_builder_id(
    session: AsyncSession, display_name: str, reserved: Iterable[str]
) -> str:
    """The graph id for a user-entered builder (D-24): the display-name slug, suffixed `-2`,
    `-3`, ... when a profile or a seed entity already holds it. Assigned once, never changed."""
    base = slugify(display_name)
    taken = set(reserved)
    taken.update(
        (
            await session.exec(
                select(Profile.builder_id).where(col(Profile.builder_id).startswith(base))
            )
        ).all()
    )
    if base not in taken:
        return base
    suffix = 2
    while f"{base}-{suffix}" in taken:
        suffix += 1
    return f"{base}-{suffix}"


async def availability_for(session: AsyncSession, profile_id: UUID) -> list[Availability]:
    statement = (
        select(Availability)
        .where(Availability.profile_id == profile_id)
        .order_by(col(Availability.start_date), col(Availability.end_date))
    )
    return list((await session.exec(statement)).all())


async def replace_availability(
    session: AsyncSession, profile_id: UUID, ranges: Iterable[tuple[date, date]]
) -> None:
    for row in await availability_for(session, profile_id):
        await session.delete(row)
    for start, end in ranges:
        session.add(Availability(profile_id=profile_id, start_date=start, end_date=end))


# -- confirmed rows: the one input verification and projection share ------------------------------


async def confirmed_rows_for(session: AsyncSession, profile_id: UUID) -> ConfirmedRows:
    credentials = (
        await session.exec(
            select(Credential)
            .where(Credential.profile_id == profile_id, Credential.status == "confirmed")
            .order_by(col(Credential.created_at))
        )
    ).all()
    projects = (
        await session.exec(
            select(Project)
            .where(Project.profile_id == profile_id, Project.status == "confirmed")
            .order_by(col(Project.created_at))
        )
    ).all()
    project_ids = [project.id for project in projects]
    links: list[ProjectSkill] = []
    if project_ids:
        links = list(
            (
                await session.exec(
                    select(ProjectSkill).where(col(ProjectSkill.project_id).in_(project_ids))
                )
            ).all()
        )
    skills_by_project: dict[UUID, list[str]] = {}
    for link in links:
        skills_by_project.setdefault(link.project_id, []).append(link.skill_id)
    return ConfirmedRows(
        credentials=tuple(
            ConfirmedCredential(credential_id=str(row.id), skill_id=row.skill_id)
            for row in credentials
        ),
        projects=tuple(
            ConfirmedProject(
                project_id=str(row.id),
                skill_ids=tuple(sorted(skills_by_project.get(row.id, []))),
                licensable=row.licensable,
                vertical=row.vertical,
            )
            for row in projects
        ),
    )
