"""Seam: migration 0003_showcase over TEST_DATABASE_URL (#88, spec #86 §Store, D-19).

Acceptance §Part A Must 1: `alembic upgrade head` applies 0003 clean, `alembic downgrade -1 &&
alembic upgrade head` runs clean, and rows written under 0002 keep their values across the
upgrade. The sync tests drive Alembic directly (its env.py runs its own event loop) and leave the
database at head; the async tests prove the new CHECKs and defaults through the ORM session.
"""

import asyncio
from collections.abc import Iterator
from datetime import date
from typing import Any
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import PACKAGE_ROOT
from app.marketplace.models import Confirmation, Credential, Profile, Project, User

PROJECT_COLUMNS = {
    "description",
    "live_url",
    "demo_url",
    "pitch_video_url",
    "pitch_deck_url",
    "showcased",
    "showcase_status",
    "showcase_confirmed_at",
}
PROFILE_COLUMNS = {"skill_set", "suggested_skills", "github_url", "linkedin_url"}
CREDENTIAL_COLUMNS = {"issued_on", "credential_url"}
SHOWCASE_INDEX = "ix_projects_showcase_status_confirmed_at"


def _config() -> Config:
    return Config(str(PACKAGE_ROOT / "alembic.ini"))


def _run(url: str, statement: str, params: dict[str, Any] | None = None) -> list[Any]:
    async def go() -> list[Any]:
        engine = create_async_engine(url)
        try:
            async with engine.begin() as connection:
                result = await connection.execute(text(statement), params or {})
                return list(result.all()) if result.returns_rows else []
        finally:
            await engine.dispose()

    return asyncio.run(go())


def _schema(url: str) -> dict[str, Any]:
    async def go() -> dict[str, Any]:
        engine = create_async_engine(url)
        try:
            async with engine.connect() as connection:

                def read(sync: Any) -> dict[str, Any]:
                    insp = inspect(sync)
                    return {
                        "columns": {
                            table: {c["name"]: c for c in insp.get_columns(table)}
                            for table in ("projects", "profiles", "credentials")
                        },
                        "checks": {
                            table: {
                                c["name"]: c["sqltext"] for c in insp.get_check_constraints(table)
                            }
                            for table in ("projects", "credentials", "confirmations")
                        },
                        "indexes": {i["name"] for i in insp.get_indexes("projects")},
                    }

                return await connection.run_sync(read)
        finally:
            await engine.dispose()

    return asyncio.run(go())


@pytest.fixture
def at_head(migrated_database: str) -> Iterator[str]:
    yield migrated_database
    command.upgrade(_config(), "head")


def test_upgrade_head_adds_the_showcase_columns(at_head: str) -> None:
    schema = _schema(at_head)
    projects = schema["columns"]["projects"]
    profiles = schema["columns"]["profiles"]
    credentials = schema["columns"]["credentials"]

    assert projects.keys() >= PROJECT_COLUMNS
    assert profiles.keys() >= PROFILE_COLUMNS
    assert credentials.keys() >= CREDENTIAL_COLUMNS
    assert credentials["skill_id"]["nullable"] is True
    assert projects["showcase_confirmed_at"]["nullable"] is True
    for name in ("showcased", "showcase_status", "description"):
        assert projects[name]["nullable"] is False, name
    for name in ("skill_set", "suggested_skills"):
        assert profiles[name]["nullable"] is False, name
    assert SHOWCASE_INDEX in schema["indexes"]
    assert "ck_projects_showcase_status" in schema["checks"]["projects"]
    assert "showcase" in schema["checks"]["confirmations"]["ck_confirmations_kind"]


def test_downgrade_removes_them_and_upgrade_restores_them(at_head: str) -> None:
    command.downgrade(_config(), "-1")
    schema = _schema(at_head)

    assert not PROJECT_COLUMNS & schema["columns"]["projects"].keys()
    assert not PROFILE_COLUMNS & schema["columns"]["profiles"].keys()
    assert not CREDENTIAL_COLUMNS & schema["columns"]["credentials"].keys()
    assert schema["columns"]["credentials"]["skill_id"]["nullable"] is False
    assert SHOWCASE_INDEX not in schema["indexes"]
    assert "showcase" not in schema["checks"]["confirmations"]["ck_confirmations_kind"]

    command.upgrade(_config(), "head")
    assert _schema(at_head)["columns"]["projects"].keys() >= PROJECT_COLUMNS


def test_rows_written_under_0002_keep_their_values(at_head: str) -> None:
    command.downgrade(_config(), "0002")
    tag = uuid4().hex[:8]
    ids = {"user": uuid4(), "profile": uuid4(), "project": uuid4(), "credential": uuid4()}
    _run(
        at_head,
        "INSERT INTO users (id, clerk_id, email, role, status) VALUES"
        " (:user, :clerk, :email, 'builder', 'confirmed')",
        {"user": ids["user"], "clerk": f"user_{tag}", "email": f"{tag}@example.com"},
    )
    _run(
        at_head,
        "INSERT INTO profiles (id, user_id, builder_id, display_name, location, day_rate,"
        " supports_remote, self_described_skills, linkedin) VALUES (:profile, :user, :slug,"
        " 'Kept', 'nairobi', 110, true, '{mobile}', 'https://linkedin.com/in/kept')",
        {"profile": ids["profile"], "user": ids["user"], "slug": f"kept-{tag}"},
    )
    _run(
        at_head,
        "INSERT INTO projects (id, profile_id, title, vertical, licensable, completed_on, status)"
        " VALUES (:project, :profile, 'Kept project', 'agri', true, '2026-08-12', 'confirmed')",
        {"project": ids["project"], "profile": ids["profile"]},
    )
    _run(
        at_head,
        "INSERT INTO credentials (id, profile_id, title, issuer, skill_id, status) VALUES"
        " (:credential, :profile, 'Mobile 301', 'MeTTa OmniUniversity', 'mobile', 'confirmed')",
        {"credential": ids["credential"], "profile": ids["profile"]},
    )
    try:
        command.upgrade(_config(), "head")

        project = _run(
            at_head,
            "SELECT title, vertical, licensable, completed_on, status, description, live_url,"
            " showcased, showcase_status, showcase_confirmed_at, demo_data FROM projects"
            " WHERE id = :id",
            {"id": ids["project"]},
        )[0]
        profile = _run(
            at_head,
            "SELECT display_name, day_rate, self_described_skills, linkedin, skill_set,"
            " suggested_skills, github_url, linkedin_url FROM profiles WHERE id = :id",
            {"id": ids["profile"]},
        )[0]
        credential = _run(
            at_head,
            "SELECT title, issuer, skill_id, status, issued_on, credential_url FROM credentials"
            " WHERE id = :id",
            {"id": ids["credential"]},
        )[0]

        assert tuple(project) == (
            "Kept project",
            "agri",
            True,
            date(2026, 8, 12),
            "confirmed",
            "",
            None,
            False,
            "none",
            None,
            True,
        )
        assert tuple(profile) == (
            "Kept",
            110,
            ["mobile"],
            "https://linkedin.com/in/kept",
            [],
            [],
            None,
            None,
        )
        assert tuple(credential) == (
            "Mobile 301",
            "MeTTa OmniUniversity",
            "mobile",
            "confirmed",
            None,
            None,
        )
    finally:
        for table, key in (
            ("credentials", "credential"),
            ("projects", "project"),
            ("profiles", "profile"),
            ("users", "user"),
        ):
            _run(at_head, f"DELETE FROM {table} WHERE id = :id", {"id": ids[key]})


# -- the new CHECKs and defaults through the ORM --------------------------------------------------


async def _chain(session: AsyncSession) -> tuple[User, Profile, Project]:
    user = User(clerk_id=f"user_{uuid4().hex}", email=f"{uuid4().hex}@example.com", role="builder")
    session.add(user)
    await session.flush()
    profile = Profile(
        user_id=user.id,
        builder_id=f"builder-{uuid4().hex[:8]}",
        display_name="Showcase Builder",
        location="nairobi",
        day_rate=100,
        supports_remote=True,
    )
    session.add(profile)
    await session.flush()
    project = Project(
        profile_id=profile.id,
        title="Showcased app",
        vertical="health",
        licensable=False,
        completed_on=date(2026, 8, 12),
    )
    session.add(project)
    await session.flush()
    return user, profile, project


@pytest.mark.anyio
async def test_new_columns_default_and_accept_showcase_values(db_session: AsyncSession) -> None:
    user, profile, project = await _chain(db_session)
    await db_session.refresh(profile)
    await db_session.refresh(project)

    assert (project.description, project.showcased, project.showcase_status) == ("", False, "none")
    assert (profile.skill_set, profile.suggested_skills) == ([], [])

    credential = Credential(profile_id=profile.id, title="Cert", issuer="Issuer", skill_id=None)
    decision = Confirmation(
        kind="showcase", target_id=project.id, decision="confirmed", admin_user_id=user.id
    )
    db_session.add_all([credential, decision])
    await db_session.flush()
    await db_session.refresh(credential)

    assert credential.skill_id is None
    assert credential.demo_data is True


@pytest.mark.anyio
async def test_showcase_checks_hold(db_session: AsyncSession) -> None:
    _user, profile, project = await _chain(db_session)
    violations: list[tuple[str, str, dict[str, Any]]] = [
        ("ck_projects_showcase_status", "projects", {"showcase_status": "'live'"}),
        ("ck_projects_description_length", "projects", {"description": "repeat('x', 1001)"}),
        ("ck_projects_live_url_length", "projects", {"live_url": "repeat('x', 501)"}),
        ("ck_projects_demo_url_length", "projects", {"demo_url": "repeat('x', 501)"}),
        ("ck_projects_pitch_video_url_length", "projects", {"pitch_video_url": "repeat('x', 501)"}),
        ("ck_projects_pitch_deck_url_length", "projects", {"pitch_deck_url": "repeat('x', 501)"}),
        ("ck_profiles_github_url_length", "profiles", {"github_url": "repeat('x', 501)"}),
        ("ck_profiles_linkedin_url_length", "profiles", {"linkedin_url": "repeat('x', 501)"}),
    ]
    targets = {"projects": project.id, "profiles": profile.id}

    for name, table, values in violations:
        assignments = ", ".join(f"{column} = {value}" for column, value in values.items())
        with pytest.raises(IntegrityError, match=name):
            async with db_session.begin_nested():
                await db_session.execute(
                    text(f"UPDATE {table} SET {assignments} WHERE id = :id"),
                    {"id": targets[table]},
                )

    with pytest.raises(IntegrityError, match="ck_credentials_credential_url_length"):
        async with db_session.begin_nested():
            db_session.add(
                Credential(profile_id=profile.id, title="C", issuer="I", credential_url="x" * 501)
            )
            await db_session.flush()
