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
    Confirmation,
    Credential,
    Profile,
    Project,
    ProjectSkill,
    Skill,
    User,
)
from app.marketplace.verification import (
    ConfirmedBuilder,
    ConfirmedCredential,
    ConfirmedProject,
    ConfirmedRows,
)

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


async def confirmed_profile_by_builder_id(
    session: AsyncSession, builder_id: str
) -> tuple[Profile, User] | None:
    """The profile and account behind a builder slug, only once an admin confirmed the account
    (DOMAIN.md §Marketplace rules); seed builder ids have no row and answer None too."""
    statement = (
        select(Profile, User)
        .join(User, col(User.id) == col(Profile.user_id))
        .where(Profile.builder_id == builder_id, User.status == "confirmed")
    )
    row = (await session.exec(statement)).first()
    return None if row is None else (row[0], row[1])


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


# -- proof rows a builder owns ------------------------------------------------


async def credentials_for(session: AsyncSession, profile_id: UUID) -> list[Credential]:
    statement = (
        select(Credential)
        .where(Credential.profile_id == profile_id)
        .order_by(col(Credential.created_at), col(Credential.id))
    )
    return list((await session.exec(statement)).all())


async def projects_for(session: AsyncSession, profile_id: UUID) -> list[tuple[Project, list[str]]]:
    """Each project with its demonstrated skill ids, in seed skill order."""
    statement = (
        select(Project)
        .where(Project.profile_id == profile_id)
        .order_by(col(Project.created_at), col(Project.id))
    )
    projects = list((await session.exec(statement)).all())
    if not projects:
        return []
    links = (
        await session.exec(
            select(ProjectSkill).where(col(ProjectSkill.project_id).in_([p.id for p in projects]))
        )
    ).all()
    order = {skill: index for index, skill in enumerate(await skill_names(session))}
    by_project: dict[UUID, list[str]] = {}
    for link in links:
        by_project.setdefault(link.project_id, []).append(link.skill_id)
    return [
        (project, sorted(by_project.get(project.id, []), key=lambda s: order.get(s, 99)))
        for project in projects
    ]


async def add_credential(
    session: AsyncSession, profile_id: UUID, *, title: str, issuer: str, skill_id: str
) -> Credential:
    row = Credential(profile_id=profile_id, title=title, issuer=issuer, skill_id=skill_id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def add_project(
    session: AsyncSession,
    profile_id: UUID,
    *,
    title: str,
    vertical: str,
    licensable: bool,
    completed_on: date,
    skill_ids: Iterable[str],
) -> Project:
    row = Project(
        profile_id=profile_id,
        title=title,
        vertical=vertical,
        licensable=licensable,
        completed_on=completed_on,
    )
    session.add(row)
    await session.flush()
    for skill_id in dict.fromkeys(skill_ids):
        session.add(ProjectSkill(project_id=row.id, skill_id=skill_id))
    await session.commit()
    await session.refresh(row)
    return row


# -- projection input: every builder whose account is confirmed ---------------


async def confirmed_builders(session: AsyncSession) -> list[ConfirmedBuilder]:
    statement = (
        select(Profile, User)
        .join(User, col(User.id) == col(Profile.user_id))
        .where(User.status == "confirmed", User.role == "builder")
        .order_by(col(Profile.builder_id))
    )
    out: list[ConfirmedBuilder] = []
    for profile, _user in (await session.exec(statement)).all():
        modes = tuple(
            mode
            for mode, on in (
                ("remote", profile.supports_remote),
                ("hybrid", profile.supports_hybrid),
                ("on-site", profile.supports_onsite),
            )
            if on
        )
        availability = tuple(
            (row.start_date, row.end_date) for row in await availability_for(session, profile.id)
        )
        out.append(
            ConfirmedBuilder(
                builder_id=profile.builder_id,
                day_rate=profile.day_rate,
                location=profile.location,
                modes=modes,
                availability=availability,
                cohort_id=profile.cohort_id,
                self_described=tuple(profile.self_described_skills),
                rows=await confirmed_rows_for(session, profile.id),
            )
        )
    return out


# -- admin queue ----------------------------------------------------------------


async def pending_accounts(session: AsyncSession) -> list[tuple[User, Profile | None]]:
    statement = (
        select(User)
        # Admins are bootstrapped confirmed (D-03) and never queue; founders and builders do.
        .where(User.status == "pending", col(User.role).in_(["founder", "builder"]))
        .order_by(col(User.created_at), col(User.id))
    )
    users = (await session.exec(statement)).all()
    return [(user, await profile_for_user(session, user.id)) for user in users]


async def pending_credentials(session: AsyncSession) -> list[tuple[Credential, Profile]]:
    statement = (
        select(Credential, Profile)
        .join(Profile, col(Profile.id) == col(Credential.profile_id))
        .where(Credential.status == "pending")
        .order_by(col(Credential.created_at), col(Credential.id))
    )
    return [(row, profile) for row, profile in (await session.exec(statement)).all()]


async def pending_projects(session: AsyncSession) -> list[tuple[Project, Profile, list[str]]]:
    statement = (
        select(Project, Profile)
        .join(Profile, col(Profile.id) == col(Project.profile_id))
        .where(Project.status == "pending")
        .order_by(col(Project.created_at), col(Project.id))
    )
    pairs = (await session.exec(statement)).all()
    out: list[tuple[Project, Profile, list[str]]] = []
    for row, profile in pairs:
        skills = [s for p, s in await projects_for(session, profile.id) if p.id == row.id]
        out.append((row, profile, skills[0] if skills else []))
    return out


async def decide(
    session: AsyncSession,
    kind: str,
    target_id: UUID,
    decision: str,
    admin_user_id: UUID,
) -> bool:
    """Set the target's status, log the decision, commit. False when the target is unknown.
    Any transition is allowed so an admin can reverse a mistake; the log keeps every step."""
    target: User | Credential | Project | None
    if kind == "account":
        target = await session.get(User, target_id)
    elif kind == "credential":
        target = await session.get(Credential, target_id)
    else:
        target = await session.get(Project, target_id)
    if target is None:
        return False
    target.status = decision
    session.add(
        Confirmation(kind=kind, target_id=target_id, decision=decision, admin_user_id=admin_user_id)
    )
    await session.commit()
    return True
