"""Seam: migration 0004_hourly_pricing over TEST_DATABASE_URL (#159, D-59, D-19).

A database at 0003 with builder day rates 120, 100, 500 and 0 upgrades to hourly rates 15, 13, 50
(capped) and 0: each value is min(50, round_half_up(day_rate / 8)), the column is renamed
`hourly_rate` and a CHECK holds it between 0 and 50. Downgrade multiplies by 8 and restores the
0003 column and constraint (lossy, acceptable for demo data). The sync tests drive Alembic
directly (its env.py runs its own event loop) and leave the database at head.

Requests and bids (#160): a 0003 request with budget 400 and a route snapshot total of 370
becomes hourly budget 50 and `totalHourlyRate` 46 (its stored brief's `dailyBudget` becomes
`hourlyBudget` 50); bids at 120 and 500 become 15 and 50 (capped). Downgrade multiplies by 8.
"""

import asyncio
import importlib.util
import json
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


def _profile_schema(url: str, table: str = "profiles") -> dict[str, Any]:
    async def go() -> dict[str, Any]:
        engine = create_async_engine(url)
        try:
            async with engine.connect() as connection:

                def read(sync: Any) -> dict[str, Any]:
                    insp = inspect(sync)
                    return {
                        "columns": {c["name"] for c in insp.get_columns(table)},
                        "checks": {
                            c["name"]: c["sqltext"] for c in insp.get_check_constraints(table)
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


# -- #160: requests and bids ---------------------------------------------------------------------

BRIEF_0003: dict[str, Any] = {
    "id": "brief-constrained-01",
    "title": "Constrained brief",
    "vertical": "health",
    "requiredSkills": ["mobile", "rust"],
    "maximumTeamSize": 2,
    "availabilityStart": "2026-09-22",
    "availabilityEnd": "2026-10-06",
    "deliveryMode": "remote",
    "location": None,
    "dailyBudget": 400,
    "preferReusableIp": False,
    "demoData": True,
}
SNAPSHOT_0003: dict[str, Any] = {
    "status": "partial",
    "totalDailyRate": 370,
    "builderIds": ["zawadi-njoroge"],
}
BID_DAY_RATES = (120, 500)
BID_HOURLY_RATES = (15, 50)


class Marketplace:
    """A founder's request and builders' bids written straight to the tables, so a test can seed
    them under 0003 (day columns) or at head (hourly columns)."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.users: list[UUID] = []
        self.profiles: list[UUID] = []
        self.bids: list[UUID] = []
        self.request = uuid4()

    def _user(self, role: str) -> UUID:
        user_id, tag = uuid4(), uuid4().hex[:8]
        _run(
            self.url,
            "INSERT INTO users (id, clerk_id, email, role, status) VALUES"
            " (:id, :clerk, :email, :role, 'confirmed')",
            {"id": user_id, "clerk": f"user_{tag}", "email": f"{tag}@example.com", "role": role},
        )
        self.users.append(user_id)
        return user_id

    def seed_request(
        self, column: str, budget: int, brief: dict[str, Any], snapshot: dict[str, Any]
    ) -> None:
        founder = self._user("founder")
        _run(
            self.url,
            "INSERT INTO requests (id, founder_id, brief, title, vertical, delivery_mode,"
            f" availability_start, availability_end, {column}, route, route_status)"
            " VALUES (:id, :founder, CAST(:brief AS jsonb), 'Constrained brief', 'health',"
            " 'remote', '2026-09-22', '2026-10-06', :budget, CAST(:route AS jsonb), 'partial')",
            {
                "id": self.request,
                "founder": founder,
                "brief": json.dumps(brief),
                "budget": budget,
                "route": json.dumps(snapshot),
            },
        )

    def seed_bids(self, column: str, rates: tuple[int, ...]) -> None:
        """One builder, profile and bid per rate; `column` names both rate columns."""
        for rate in rates:
            user_id, profile_id, bid_id = self._user("builder"), uuid4(), uuid4()
            _run(
                self.url,
                f"INSERT INTO profiles (id, user_id, builder_id, display_name, location, {column},"
                " supports_remote) VALUES (:id, :user, :slug, 'Bidder', 'nairobi', 15, true)",
                {"id": profile_id, "user": user_id, "slug": f"bidder-{uuid4().hex[:8]}"},
            )
            self.profiles.append(profile_id)
            _run(
                self.url,
                f"INSERT INTO bids (id, request_id, profile_id, {column}, eligible_skills, path)"
                " VALUES (:id, :request, :profile, :rate, '[]', '{}')",
                {"id": bid_id, "request": self.request, "profile": profile_id, "rate": rate},
            )
            self.bids.append(bid_id)

    def request_row(self, column: str) -> tuple[int, dict[str, Any], dict[str, Any]]:
        budget, brief, route = _run(
            self.url,
            f"SELECT {column}, brief, route FROM requests WHERE id = :id",
            {"id": self.request},
        )[0]
        return budget, brief, route

    def bid_rates(self, column: str) -> tuple[int, ...]:
        return tuple(
            _run(self.url, f"SELECT {column} FROM bids WHERE id = :id", {"id": bid_id})[0][0]
            for bid_id in self.bids
        )

    def delete(self) -> None:
        for bid_id in self.bids:
            _run(self.url, "DELETE FROM bids WHERE id = :id", {"id": bid_id})
        _run(self.url, "DELETE FROM requests WHERE id = :id", {"id": self.request})
        for profile_id in self.profiles:
            _run(self.url, "DELETE FROM profiles WHERE id = :id", {"id": profile_id})
        for user_id in self.users:
            _run(self.url, "DELETE FROM users WHERE id = :id", {"id": user_id})


@pytest.fixture
def marketplace(at_head: str) -> Iterator[Marketplace]:
    data = Marketplace(at_head)
    try:
        yield data
    finally:
        data.delete()


def test_upgrade_converts_the_request_budget_and_route_snapshot(marketplace: Marketplace) -> None:
    command.downgrade(_config(), "0003")
    marketplace.seed_request("daily_budget", 400, BRIEF_0003, SNAPSHOT_0003)

    command.upgrade(_config(), "0004")

    schema = _profile_schema(marketplace.url, "requests")
    assert "hourly_budget" in schema["columns"]
    assert "daily_budget" not in schema["columns"]
    assert "ck_requests_hourly_budget" in schema["checks"]
    assert "ck_requests_daily_budget" not in schema["checks"]
    budget, brief, route = marketplace.request_row("hourly_budget")
    assert budget == 50
    assert route == {"status": "partial", "totalHourlyRate": 46, "builderIds": ["zawadi-njoroge"]}
    unchanged = {key: value for key, value in BRIEF_0003.items() if key != "dailyBudget"}
    assert brief == {**unchanged, "hourlyBudget": 50}


def test_upgrade_clamps_a_request_budget_to_one_through_two_fifty(
    marketplace: Marketplace,
) -> None:
    """USD 3 a day rounds to 0 an hour and is raised to 1; USD 2400 a day is held at 250."""
    command.downgrade(_config(), "0003")
    marketplace.seed_request("daily_budget", 3, {**BRIEF_0003, "dailyBudget": 2400}, SNAPSHOT_0003)

    command.upgrade(_config(), "0004")

    budget, brief, _route = marketplace.request_row("hourly_budget")
    assert (budget, brief["hourlyBudget"]) == (1, 250)


def test_upgrade_converts_bid_rates_capped_at_fifty(marketplace: Marketplace) -> None:
    command.downgrade(_config(), "0003")
    marketplace.seed_request("daily_budget", 400, BRIEF_0003, SNAPSHOT_0003)
    marketplace.seed_bids("day_rate", BID_DAY_RATES)

    command.upgrade(_config(), "0004")

    schema = _profile_schema(marketplace.url, "bids")
    assert "hourly_rate" in schema["columns"]
    assert "day_rate" not in schema["columns"]
    assert "ck_bids_hourly_rate" in schema["checks"]
    assert "ck_bids_day_rate" not in schema["checks"]
    assert marketplace.bid_rates("hourly_rate") == BID_HOURLY_RATES


def test_request_budget_and_bid_rate_checks_hold_at_head(marketplace: Marketplace) -> None:
    command.upgrade(_config(), "head")
    hourly_brief = {key: value for key, value in BRIEF_0003.items() if key != "dailyBudget"}
    marketplace.seed_request(
        "hourly_budget",
        50,
        {**hourly_brief, "hourlyBudget": 50},
        {"status": "partial", "totalHourlyRate": 46, "builderIds": []},
    )
    marketplace.seed_bids("hourly_rate", (0, 50))

    for budget in (0, 251):
        with pytest.raises(IntegrityError, match="ck_requests_hourly_budget"):
            _run(
                marketplace.url,
                "UPDATE requests SET hourly_budget = :budget WHERE id = :id",
                {"budget": budget, "id": marketplace.request},
            )
    for rate in (-1, 51):
        with pytest.raises(IntegrityError, match="ck_bids_hourly_rate"):
            _run(
                marketplace.url,
                "UPDATE bids SET hourly_rate = :rate WHERE id = :id",
                {"rate": rate, "id": marketplace.bids[0]},
            )


def test_downgrade_restores_daily_request_and_bid_figures(marketplace: Marketplace) -> None:
    """Round trip 0003 -> 0004 -> 0003 multiplies by 8; lossy (370 a day returns as 368, and a
    bid capped at 50 returns as 400)."""
    command.downgrade(_config(), "0003")
    marketplace.seed_request("daily_budget", 400, BRIEF_0003, SNAPSHOT_0003)
    marketplace.seed_bids("day_rate", BID_DAY_RATES)
    command.upgrade(_config(), "0004")

    command.downgrade(_config(), "0003")

    requests = _profile_schema(marketplace.url, "requests")
    bids = _profile_schema(marketplace.url, "bids")
    assert "daily_budget" in requests["columns"]
    assert "hourly_budget" not in requests["columns"]
    assert "ck_requests_daily_budget" in requests["checks"]
    assert "day_rate" in bids["columns"]
    assert "hourly_rate" not in bids["columns"]
    assert "ck_bids_day_rate" in bids["checks"]
    budget, brief, route = marketplace.request_row("daily_budget")
    assert budget == 400
    assert brief == BRIEF_0003
    assert route == {**SNAPSHOT_0003, "totalDailyRate": 368}
    assert marketplace.bid_rates("day_rate") == (120, 400)
