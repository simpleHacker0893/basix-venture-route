"""Seam: the marketplace session over TEST_DATABASE_URL after `alembic upgrade head` (D-17, D-19).

Sprint 003 acceptance: "Every table has `demo_data` defaulting to true with a check constraint
(migration test)" and "`alembic upgrade head` runs clean on an empty Neon branch and on the
compose `db`". The session fixture drops the schema and upgrades from empty once per session, so
a passing suite is the "runs clean on an empty database" evidence.
"""

from collections.abc import Callable
from datetime import date
from uuid import UUID, uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import (
    Availability,
    Confirmation,
    Credential,
    DemoRow,
    Profile,
    Project,
    ProjectSkill,
    Skill,
    User,
)

pytestmark = pytest.mark.anyio

# The nine stable skill ids from CONTEXT.md §Skills (independent of the migration's own list).
SKILL_IDS = {
    "python",
    "ai-metta",
    "ui-ux",
    "frontend",
    "backend",
    "domain-research",
    "mobile",
    "rust",
    "data",
}


async def test_upgrade_head_seeds_the_nine_skills(db_session: AsyncSession) -> None:
    rows = (await db_session.exec(select(Skill))).all()

    assert {row.id for row in rows} == SKILL_IDS
    assert all(row.name for row in rows)


async def _seed_chain(session: AsyncSession) -> tuple[UUID, UUID, UUID, UUID]:
    """One valid user → profile → project so every child table has a parent to point at, plus a
    second user without a profile for the profiles row (one profile per user)."""
    user = User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="builder")
    other = User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="builder")
    session.add_all([user, other])
    await session.flush()
    profile = Profile(
        user_id=user.id,
        builder_id=f"builder-{uuid4().hex[:8]}",
        display_name="Test Builder",
        location="nairobi",
        day_rate=100,
        supports_remote=True,
    )
    session.add(profile)
    await session.flush()
    project = Project(
        profile_id=profile.id,
        title="Clinic triage intake flow",
        vertical="health",
        licensable=True,
        completed_on=date(2026, 8, 12),
    )
    session.add(project)
    await session.flush()
    return user.id, other.id, profile.id, project.id


def _rows(
    user_id: UUID, other_user_id: UUID, profile_id: UUID, project_id: UUID
) -> list[Callable[[], DemoRow]]:
    """One minimal row per table, built lazily so each attempt gets a fresh instance."""
    return [
        lambda: User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com"),
        lambda: Profile(
            user_id=other_user_id,
            builder_id=f"builder-{uuid4().hex[:8]}",
            display_name="Other",
            location="kisumu",
            day_rate=90,
            supports_hybrid=True,
        ),
        lambda: Skill(id=f"skill-{uuid4().hex[:6]}", name="Temporary"),
        lambda: Credential(profile_id=profile_id, title="Cert", issuer="Issuer", skill_id="python"),
        lambda: Project(
            profile_id=profile_id,
            title="Another",
            vertical="agri",
            licensable=False,
            completed_on=date(2026, 7, 1),
        ),
        lambda: ProjectSkill(project_id=project_id, skill_id="rust"),
        lambda: Availability(
            profile_id=profile_id, start_date=date(2026, 9, 22), end_date=date(2026, 10, 6)
        ),
        lambda: Confirmation(
            kind="project", target_id=project_id, decision="confirmed", admin_user_id=user_id
        ),
    ]


async def test_every_table_defaults_demo_data_to_true(db_session: AsyncSession) -> None:
    ids = await _seed_chain(db_session)

    for make in _rows(*ids):
        row = make()
        db_session.add(row)
        await db_session.flush()
        await db_session.refresh(row)
        assert row.demo_data is True, type(row).__name__


async def test_every_table_rejects_demo_data_false(db_session: AsyncSession) -> None:
    ids = await _seed_chain(db_session)

    for make in _rows(*ids):
        row = make()
        row.demo_data = False
        with pytest.raises(IntegrityError, match="demo_data"):
            async with db_session.begin_nested():
                db_session.add(row)
                await db_session.flush()
