"""Seam: the marketplace session over TEST_DATABASE_URL after `alembic upgrade head` (D-17, D-19).

Sprint 003 acceptance: "Every table has `demo_data` defaulting to true with a check constraint
(migration test)" and "`alembic upgrade head` runs clean on an empty Neon branch and on the
compose `db`". The session fixture drops the schema and upgrades from empty once per session, so
a passing suite is the "runs clean on an empty database" evidence.

Sprint 004 (#53) extends the table to `requests`, `bids` and `bookings` (migration 0002) and proves
every CHECK and the UNIQUE the spec lists by catching the IntegrityError.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any, NamedTuple
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import (
    Availability,
    Bid,
    Booking,
    Confirmation,
    Credential,
    DemoRow,
    Profile,
    Project,
    ProjectSkill,
    Request,
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

# The seed Constrained brief in wire shape (DOMAIN.md §Demo scenarios), as a founder would
# publish it; the request's promoted columns repeat its fields.
CONSTRAINED_BRIEF: dict[str, Any] = {
    "id": "brief-constrained-01",
    "title": "Constrained brief",
    "vertical": "health",
    "requiredSkills": ["mobile", "rust"],
    "maximumTeamSize": 2,
    "availabilityStart": "2026-09-22",
    "availabilityEnd": "2026-10-06",
    "deliveryMode": "remote",
    "location": None,
    "dailyBudget": 300,
    "preferReusableIp": False,
    "demoData": True,
}
ROUTE_SNAPSHOT: dict[str, Any] = {
    "status": "partial",
    "totalDailyRate": 130,
    "builderIds": ["zawadi-njoroge"],
}
ELIGIBLE_PATH: dict[str, Any] = {
    "rule": "eligible-builder",
    "facts": ["(confirmed admin-basix naomi-chebet)"],
    "conclusion": "(eligible-builder brief-constrained-01 naomi-chebet mobile credential)",
}
PROPOSE_ENTRY: dict[str, Any] = {
    "action": "propose",
    "actor": "founder",
    "state": "proposed",
    "proposedStart": "2026-09-24T06:00:00+00:00",
    "durationMin": 30,
    "note": "",
    "at": "2026-09-23T10:00:00+00:00",
}
START = datetime(2026, 9, 24, 6, 0, tzinfo=UTC)


async def test_upgrade_head_seeds_the_nine_skills(db_session: AsyncSession) -> None:
    rows = (await db_session.exec(select(Skill))).all()

    assert {row.id for row in rows} == SKILL_IDS
    assert all(row.name for row in rows)


class Seeded(NamedTuple):
    user_id: UUID
    other_user_id: UUID
    founder_id: UUID
    profile_id: UUID
    project_id: UUID
    request_id: UUID


def _request(founder_id: UUID, **overrides: Any) -> Request:
    fields: dict[str, Any] = {
        "founder_id": founder_id,
        "brief": CONSTRAINED_BRIEF,
        "title": "Constrained brief",
        "vertical": "health",
        "delivery_mode": "remote",
        "availability_start": date(2026, 9, 22),
        "availability_end": date(2026, 10, 6),
        "daily_budget": 300,
        "route": ROUTE_SNAPSHOT,
        "route_status": "partial",
    }
    return Request(**{**fields, **overrides})


def _bid(request_id: UUID, profile_id: UUID, **overrides: Any) -> Bid:
    fields: dict[str, Any] = {
        "request_id": request_id,
        "profile_id": profile_id,
        "day_rate": 120,
        "message": "The field survey app demonstrates mobile.",
        "eligible_skills": ["mobile"],
        "path": ELIGIBLE_PATH,
    }
    return Bid(**{**fields, **overrides})


def _booking(founder_id: UUID, profile_id: UUID, **overrides: Any) -> Booking:
    fields: dict[str, Any] = {
        "request_id": None,
        "founder_id": founder_id,
        "profile_id": profile_id,
        "proposed_start": START,
        "duration_min": 30,
        "history": [PROPOSE_ENTRY],
        "note": "",
    }
    return Booking(**{**fields, **overrides})


async def _seed_chain(session: AsyncSession) -> Seeded:
    """One valid user -> profile -> project so every child table has a parent to point at, plus
    a second user without a profile for the profiles row (one profile per user), a founder and
    one open request for the bids and bookings rows."""
    user = User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="builder")
    other = User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="builder")
    founder = User(
        clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="founder"
    )
    session.add_all([user, other, founder])
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
    request = _request(founder.id)
    session.add_all([project, request])
    await session.flush()
    return Seeded(user.id, other.id, founder.id, profile.id, project.id, request.id)


def _rows(seeded: Seeded) -> list[Callable[[], DemoRow]]:
    """One minimal row per table, built lazily so each attempt gets a fresh instance."""
    return [
        lambda: User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com"),
        lambda: Profile(
            user_id=seeded.other_user_id,
            builder_id=f"builder-{uuid4().hex[:8]}",
            display_name="Other",
            location="kisumu",
            day_rate=90,
            supports_hybrid=True,
        ),
        lambda: Skill(id=f"skill-{uuid4().hex[:6]}", name="Temporary"),
        lambda: Credential(
            profile_id=seeded.profile_id, title="Cert", issuer="Issuer", skill_id="python"
        ),
        lambda: Project(
            profile_id=seeded.profile_id,
            title="Another",
            vertical="agri",
            licensable=False,
            completed_on=date(2026, 7, 1),
        ),
        lambda: ProjectSkill(project_id=seeded.project_id, skill_id="rust"),
        lambda: Availability(
            profile_id=seeded.profile_id, start_date=date(2026, 9, 22), end_date=date(2026, 10, 6)
        ),
        lambda: Confirmation(
            kind="project",
            target_id=seeded.project_id,
            decision="confirmed",
            admin_user_id=seeded.user_id,
        ),
        # Sprint 004 (#53): requests, bids, bookings.
        lambda: _request(seeded.founder_id),
        lambda: _bid(seeded.request_id, seeded.profile_id),
        lambda: _booking(seeded.founder_id, seeded.profile_id, request_id=seeded.request_id),
    ]


async def test_every_table_defaults_demo_data_to_true(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)

    rows = _rows(seeded)
    assert len(rows) == 11, "eleven demo-data checks across the twelve tables (skills is seeded)"
    for make in rows:
        row = make()
        db_session.add(row)
        await db_session.flush()
        await db_session.refresh(row)
        assert row.demo_data is True, type(row).__name__


async def test_every_table_rejects_demo_data_false(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)

    for make in _rows(seeded):
        row = make()
        row.demo_data = False
        with pytest.raises(IntegrityError, match="demo_data"):
            async with db_session.begin_nested():
                db_session.add(row)
                await db_session.flush()


async def test_sprint_004_tables_reject_demo_data_null(db_session: AsyncSession) -> None:
    """The ORM omits a None so the server default fires; only a literal NULL proves NOT NULL."""
    seeded = await _seed_chain(db_session)
    inserts = {
        "requests": (
            "INSERT INTO requests (id, founder_id, brief, title, vertical, delivery_mode,"
            " availability_start, availability_end, daily_budget, route, route_status, demo_data)"
            " VALUES (gen_random_uuid(), :founder, '{}', 't', 'health', 'remote', '2026-09-22',"
            " '2026-10-06', 300, '{}', 'partial', NULL)"
        ),
        "bids": (
            "INSERT INTO bids (id, request_id, profile_id, day_rate, eligible_skills, path,"
            " demo_data) VALUES (gen_random_uuid(), :request, :profile, 120, '[]', '{}', NULL)"
        ),
        "bookings": (
            "INSERT INTO bookings (id, founder_id, profile_id, proposed_start, duration_min,"
            " history, demo_data) VALUES (gen_random_uuid(), :founder, :profile,"
            " '2026-09-24T06:00:00+00:00', 30, '[]', NULL)"
        ),
    }
    params = {
        "founder": seeded.founder_id,
        "request": seeded.request_id,
        "profile": seeded.profile_id,
    }

    for table, statement in inserts.items():
        with pytest.raises(IntegrityError, match="demo_data"):
            async with db_session.begin_nested():
                await db_session.execute(text(statement), params)
        assert table  # one attempt per Sprint 004 table


# -- Sprint 004 (#53): every CHECK and the UNIQUE from spec #52 §Store ----------------------------


def _sprint_004_constraints(seeded: Seeded) -> list[tuple[str, Callable[[], DemoRow]]]:
    """(constraint name the database reports, a row that violates it)."""
    founder, profile, request = seeded.founder_id, seeded.profile_id, seeded.request_id
    return [
        (
            "ck_requests_window",
            lambda: _request(
                founder, availability_start=date(2026, 10, 6), availability_end=date(2026, 9, 22)
            ),
        ),
        ("ck_requests_daily_budget", lambda: _request(founder, daily_budget=0)),
        ("ck_requests_route_status", lambda: _request(founder, route_status="great")),
        ("ck_requests_status", lambda: _request(founder, status="paused")),
        ("ck_bids_day_rate", lambda: _bid(request, profile, day_rate=0)),
        ("ck_bids_message_length", lambda: _bid(request, profile, message="x" * 1001)),
        ("ck_bids_status", lambda: _bid(request, profile, status="withdrawn")),
        ("ck_bookings_duration", lambda: _booking(founder, profile, duration_min=60)),
        ("ck_bookings_state", lambda: _booking(founder, profile, state="cancelled")),
        ("ck_bookings_note_length", lambda: _booking(founder, profile, note="x" * 501)),
    ]


async def test_sprint_004_check_constraints_hold(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)

    for name, make in _sprint_004_constraints(seeded):
        with pytest.raises(IntegrityError, match=name):
            async with db_session.begin_nested():
                db_session.add(make())
                await db_session.flush()


async def test_one_bid_per_builder_per_request(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)
    db_session.add(_bid(seeded.request_id, seeded.profile_id))
    await db_session.flush()

    with pytest.raises(IntegrityError, match="uq_bids_request_profile"):
        async with db_session.begin_nested():
            db_session.add(_bid(seeded.request_id, seeded.profile_id, day_rate=99))
            await db_session.flush()


async def test_a_bid_needs_an_existing_request_and_profile(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)

    with pytest.raises(IntegrityError, match="bids_request_id_fkey"):
        async with db_session.begin_nested():
            db_session.add(_bid(uuid4(), seeded.profile_id))
            await db_session.flush()


async def test_a_booking_may_stand_without_a_request(db_session: AsyncSession) -> None:
    seeded = await _seed_chain(db_session)
    row = _booking(seeded.founder_id, seeded.profile_id)
    db_session.add(row)
    await db_session.flush()
    await db_session.refresh(row)

    assert row.request_id is None
    assert row.state == "proposed"
    assert row.history == [PROPOSE_ENTRY]
    assert row.proposed_start == START
