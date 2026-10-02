"""Seam: migration 0004_hourly_pricing over TEST_DATABASE_URL (#159, D-59, D-19).

A database at 0003 with builder day rates 120, 100, 500 and 0 upgrades to hourly rates 15, 13, 50
(capped) and 0: each value is min(50, round_half_up(day_rate / 8)), the column is renamed
`hourly_rate` and a CHECK holds it between 0 and 50. Downgrade multiplies by 8 and restores the
0003 column and constraint (lossy, acceptable for demo data). The sync tests drive Alembic
directly (its env.py runs its own event loop) and leave the database at head.
"""

import asyncio
import importlib.util
from collections.abc import Iterator
from typing import Any
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import PACKAGE_ROOT

DAY_RATES = (120, 100, 500, 0)
HOURLY_RATES = (15, 13, 50, 0)


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


def _profile_schema(url: str) -> dict[str, Any]:
    async def go() -> dict[str, Any]:
        engine = create_async_engine(url)
        try:
            async with engine.connect() as connection:

                def read(sync: Any) -> dict[str, Any]:
                    insp = inspect(sync)
                    return {
                        "columns": {c["name"] for c in insp.get_columns("profiles")},
                        "checks": {
                            c["name"]: c["sqltext"] for c in insp.get_check_constraints("profiles")
                        },
                    }

                return await connection.run_sync(read)
        finally:
            await engine.dispose()

    return asyncio.run(go())


def test_revision_0004_follows_0003_and_is_head() -> None:
    """No database needed: the migration file exists and chains after 0003."""
    path = PACKAGE_ROOT / "alembic" / "versions" / "0004_hourly_pricing.py"
    spec = importlib.util.spec_from_file_location("migration_0004", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert (module.revision, module.down_revision) == ("0004", "0003")


@pytest.fixture
def at_head(migrated_database: str) -> Iterator[str]:
    yield migrated_database
    command.upgrade(_config(), "head")


def _seed_0003_profiles(url: str, rates: tuple[int, ...]) -> list[tuple[UUID, UUID]]:
    """One user and profile per day rate, written under 0003. 0003 holds `day_rate > 0`, so a
    zero rate is written with that check dropped, as a database that predates it might hold."""
    _run(url, "ALTER TABLE profiles DROP CONSTRAINT ck_profiles_day_rate")
    rows: list[tuple[UUID, UUID]] = []
    for rate in rates:
        user_id, profile_id, tag = uuid4(), uuid4(), uuid4().hex[:8]
        _run(
            url,
            "INSERT INTO users (id, clerk_id, email, role, status) VALUES"
            " (:id, :clerk, :email, 'builder', 'confirmed')",
            {"id": user_id, "clerk": f"user_{tag}", "email": f"{tag}@example.com"},
        )
        _run(
            url,
            "INSERT INTO profiles (id, user_id, builder_id, display_name, location, day_rate,"
            " supports_remote) VALUES (:id, :user, :slug, 'Rate', 'nairobi', :rate, true)",
            {"id": profile_id, "user": user_id, "slug": f"rate-{tag}", "rate": rate},
        )
        rows.append((user_id, profile_id))
    _run(
        url,
        "ALTER TABLE profiles ADD CONSTRAINT ck_profiles_day_rate CHECK (day_rate > 0) NOT VALID",
    )
    return rows


def _delete(url: str, rows: list[tuple[UUID, UUID]]) -> None:
    for user_id, profile_id in rows:
        _run(url, "DELETE FROM profiles WHERE id = :id", {"id": profile_id})
        _run(url, "DELETE FROM users WHERE id = :id", {"id": user_id})


def _rates(url: str, column: str, rows: list[tuple[UUID, UUID]]) -> tuple[int, ...]:
    return tuple(
        _run(url, f"SELECT {column} FROM profiles WHERE id = :id", {"id": profile_id})[0][0]
        for _user, profile_id in rows
    )


def test_upgrade_converts_day_rates_to_capped_hourly_rates(at_head: str) -> None:
    command.downgrade(_config(), "0003")
    rows = _seed_0003_profiles(at_head, DAY_RATES)
    try:
        command.upgrade(_config(), "0004")

        schema = _profile_schema(at_head)
        assert "hourly_rate" in schema["columns"]
        assert "day_rate" not in schema["columns"]
        assert "ck_profiles_hourly_rate" in schema["checks"]
        assert "ck_profiles_day_rate" not in schema["checks"]
        assert _rates(at_head, "hourly_rate", rows) == HOURLY_RATES
    finally:
        _delete(at_head, rows)


def test_hourly_rate_check_holds_zero_to_fifty(at_head: str) -> None:
    command.upgrade(_config(), "head")
    rows = _seed_hourly(at_head, (0, 50))
    try:
        for bad in (-1, 51):
            with pytest.raises(IntegrityError, match="ck_profiles_hourly_rate"):
                _run(
                    at_head,
                    "UPDATE profiles SET hourly_rate = :rate WHERE id = :id",
                    {"rate": bad, "id": rows[0][1]},
                )
    finally:
        _delete(at_head, rows)


def _seed_hourly(url: str, rates: tuple[int, ...]) -> list[tuple[UUID, UUID]]:
    rows: list[tuple[UUID, UUID]] = []
    for rate in rates:
        user_id, profile_id, tag = uuid4(), uuid4(), uuid4().hex[:8]
        _run(
            url,
            "INSERT INTO users (id, clerk_id, email, role, status) VALUES"
            " (:id, :clerk, :email, 'builder', 'confirmed')",
            {"id": user_id, "clerk": f"user_{tag}", "email": f"{tag}@example.com"},
        )
        _run(
            url,
            "INSERT INTO profiles (id, user_id, builder_id, display_name, location, hourly_rate,"
            " supports_remote) VALUES (:id, :user, :slug, 'Rate', 'nairobi', :rate, true)",
            {"id": profile_id, "user": user_id, "slug": f"rate-{tag}", "rate": rate},
        )
        rows.append((user_id, profile_id))
    return rows


def test_downgrade_multiplies_by_eight_and_restores_day_rate(at_head: str) -> None:
    """0003 cannot hold a free (0) rate, so a 0 comes back as the smallest day rate it can: 1."""
    command.upgrade(_config(), "head")
    rows = _seed_hourly(at_head, (15, 13, 1, 0))
    try:
        command.downgrade(_config(), "0003")

        schema = _profile_schema(at_head)
        assert "day_rate" in schema["columns"]
        assert "hourly_rate" not in schema["columns"]
        assert "ck_profiles_day_rate" in schema["checks"]
        assert "ck_profiles_hourly_rate" not in schema["checks"]
        assert _rates(at_head, "day_rate", rows) == (120, 104, 8, 1)
    finally:
        _delete(at_head, rows)
