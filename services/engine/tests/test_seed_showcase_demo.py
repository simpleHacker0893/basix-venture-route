"""Seam: `scripts/seed_showcase_demo.py` run against TEST_DATABASE_URL, then HTTP and
`RouteService` (#107, D-19).

The demo opens with Showcase content: Venture Route itself plus two fictional entries, read from
`seed/showcase_demo.json`. The seed must never change a route (spec #86 Testing 7: the five demo
scenarios deep-equal before and after), must be idempotent (a second run changes no row), and
must never touch a real Clerk sign-up.
"""

import json
import sys
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import render_program, reproject
from app.marketplace import repo
from app.marketplace.models import User
from app.models.brief import VentureBrief
from app.routing.route_service import RouteService
from tests.conftest import Actor

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from seed_showcase_demo import (  # noqa: E402
    ADMIN_CLERK_ID,
    DEMO_PATH,
    SeedError,
    load_demo,
    main,
    seed_and_reproject,
)

pytestmark = pytest.mark.anyio

SCENARIOS = (
    "brief-health-01",
    "brief-agri-01",
    "brief-constrained-01",
    "brief-budget-01",
    "brief-onsite-01",
)

TABLES = (
    "users",
    "profiles",
    "skills",
    "credentials",
    "projects",
    "project_skills",
    "availability",
    "confirmations",
)

OPERATOR = "demo-njuguna-njenga"

EXPECTED_TITLES = ["Venture Route", "Crop price SMS digest", "School fees tracker"]


def _routes(engine: MettaRouteEngine, briefs: dict[str, VentureBrief]) -> dict[str, Any]:
    service = RouteService(engine)
    return {brief_id: service.route(briefs[brief_id]).model_dump() for brief_id in SCENARIOS}


async def _snapshot(session: AsyncSession) -> dict[str, list[str]]:
    """Every row of every marketplace table as sorted JSON text: counts and values at once."""
    out: dict[str, list[str]] = {}
    for table in TABLES:
        rows = (
            await session.exec(  # type: ignore[call-overload]
                text(f"SELECT row_to_json(t)::text FROM {table} t")
            )
        ).all()
        out[table] = sorted(row[0] for row in rows)
    return out


async def _rows_of(session: AsyncSession, builder: Actor) -> dict[str, list[str]]:
    """A real sign-up's rows, every table that references the user or the profile."""
    queries = {
        "users": "SELECT row_to_json(t)::text FROM users t WHERE t.id = :u",
        "profiles": "SELECT row_to_json(t)::text FROM profiles t WHERE t.user_id = :u",
        "credentials": (
            "SELECT row_to_json(t)::text FROM credentials t WHERE t.profile_id IN "
            "(SELECT id FROM profiles WHERE user_id = :u)"
        ),
        "projects": (
            "SELECT row_to_json(t)::text FROM projects t WHERE t.profile_id IN "
            "(SELECT id FROM profiles WHERE user_id = :u)"
        ),
        "availability": (
            "SELECT row_to_json(t)::text FROM availability t WHERE t.profile_id IN "
            "(SELECT id FROM profiles WHERE user_id = :u)"
        ),
    }
    out: dict[str, list[str]] = {}
    for name, sql in queries.items():
        rows = (
            await session.exec(  # type: ignore[call-overload]
                text(sql).bindparams(u=builder.user_id)
            )
        ).all()
        out[name] = sorted(row[0] for row in rows)
    return out


async def test_the_seed_leaves_the_five_demo_scenarios_route_equal(
    api: AsyncClient,
    db_session: AsyncSession,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    await reproject(engine, db_session)
    before = _routes(engine, briefs)

    summary = await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    assert summary.entries == 3
    assert _routes(engine, briefs) == before


async def test_after_the_seed_the_gallery_lists_exactly_the_three_entries(
    api: AsyncClient, db_session: AsyncSession, engine: MettaRouteEngine
) -> None:
    await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    page = await api.get("/api/showcase")
    assert page.status_code == 200, page.text
    body = page.json()
    assert body["total"] == 3
    assert [item["title"] for item in body["items"]] == EXPECTED_TITLES
    venture_route = body["items"][0]
    assert venture_route["builderId"] == "demo-njuguna-njenga"
    assert venture_route["displayName"] == "Njuguna Njenga"
    assert venture_route["vertical"] == "education"
    assert sorted(venture_route["skillIds"]) == ["ai-metta", "backend", "frontend", "python"]
    assert venture_route["liveUrl"] == "https://example.org/venture-route/live"
    assert venture_route["pitchVideoUrl"] is None
    assert all(item["demoData"] for item in body["items"])
    assert [item["licensable"] for item in body["items"]] == [False, False, True]

    for item in body["items"][1:]:  # the fictional builders
        detail = await api.get(f"/api/showcase/{item['id']}")
        assert detail.status_code == 200, detail.text
        builder = detail.json()["builder"]
        assert builder["builderId"].startswith("demo-")
        assert 2 <= len(builder["skillSet"]) <= 3
        (certification,) = builder["certifications"]
        assert certification["skillId"] is None


async def test_the_seed_invents_no_facts_about_the_operator(
    api: AsyncClient, db_session: AsyncSession, engine: MettaRouteEngine
) -> None:
    """R26 (AGENTS.md rule 10): Njuguna Njenga is the one real person in the seed. His profile
    carries his name and the Venture Route entry only: no cohort, certification or chips."""
    await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    (operator,) = [
        builder
        for builder in await repo.confirmed_builders(db_session)
        if builder.builder_id == OPERATOR
    ]
    lines = render_program([operator])
    assert not [
        line
        for line in lines
        if line.startswith(("(belongs-to", "(certified", "(has-skill-set", "(suggested-skill"))
    ]
    assert not [line for line in lines if line.startswith(("(earned", "(available"))]

    page = (await api.get("/api/showcase")).json()
    (entry,) = [item for item in page["items"] if item["builderId"] == OPERATOR]
    assert entry["cohortId"] is None
    detail = (await api.get(f"/api/showcase/{entry['id']}")).json()
    builder = detail["builder"]
    assert builder["displayName"] == "Njuguna Njenga"
    assert builder["certifications"] == []
    assert builder["skillSet"] == []
    assert builder["cohortId"] is None
    assert (builder["githubUrl"], builder["linkedinUrl"]) == (None, None)
    assert detail["pitchVideoUrl"] is None
    assert all(
        (detail[key] or "https://example.org/").startswith("https://example.org/")
        for key in ("liveUrl", "demoUrl", "pitchDeckUrl")
    )


async def _counts(session: AsyncSession) -> dict[str, int]:
    return {table: len(rows) for table, rows in (await _snapshot(session)).items()}


async def test_a_non_seed_user_holding_the_seed_admin_clerk_id_aborts_with_nothing_written(
    api: AsyncClient, db_session: AsyncSession, engine: MettaRouteEngine
) -> None:
    db_session.add(User(clerk_id=ADMIN_CLERK_ID, email="someone@example.com", role="admin"))
    await db_session.commit()
    before = await _snapshot(db_session)

    with pytest.raises(SeedError):
        await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    await db_session.rollback()
    assert await _snapshot(db_session) == before


async def test_a_real_profile_holding_a_seed_builder_id_aborts_with_nothing_written(
    api: AsyncClient,
    db_session: AsyncSession,
    engine: MettaRouteEngine,
    pending_builder: Actor,
) -> None:
    profile = await repo.profile_for_user(db_session, pending_builder.user_id)
    assert profile is not None
    profile.builder_id = "demo-achieng-owino"
    db_session.add(profile)
    await db_session.commit()
    before = await _snapshot(db_session)

    with pytest.raises(SeedError):
        await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    await db_session.rollback()
    after = await _snapshot(db_session)
    assert after == before
    assert (await _counts(db_session))["confirmations"] == 0


async def test_seed_builders_have_no_availability_and_no_mobile_skill(
    api: AsyncClient, db_session: AsyncSession, engine: MettaRouteEngine
) -> None:
    await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    seeded = (
        await db_session.exec(  # type: ignore[call-overload]
            text(
                "SELECT p.id, u.clerk_id, u.status, u.role FROM profiles p "
                "JOIN users u ON u.id = p.user_id WHERE p.builder_id LIKE 'demo-%'"
            )
        )
    ).all()
    assert len(seeded) == 3
    for profile_id, clerk_id, status, role in seeded:
        assert clerk_id.startswith("seed_demo_")
        assert (status, role) == ("confirmed", "builder")
        availability = (
            await db_session.exec(  # type: ignore[call-overload]
                text("SELECT count(*) FROM availability WHERE profile_id = :p").bindparams(
                    p=profile_id
                )
            )
        ).one()
        assert availability[0] == 0
    mobile = (
        await db_session.exec(  # type: ignore[call-overload]
            text(
                "SELECT count(*) FROM project_skills ps JOIN projects pr ON pr.id = ps.project_id "
                "JOIN profiles p ON p.id = pr.profile_id "
                "WHERE p.builder_id LIKE 'demo-%' AND ps.skill_id = 'mobile'"
            )
        )
    ).one()
    assert mobile[0] == 0
    kinds = (
        await db_session.exec(  # type: ignore[call-overload]
            text(
                "SELECT DISTINCT c.kind FROM confirmations c JOIN users u "
                "ON u.id = c.admin_user_id WHERE u.clerk_id = 'seed_basix_admin'"
            )
        )
    ).all()
    assert sorted(row[0] for row in kinds) == ["account", "credential", "project", "showcase"]


async def test_running_the_seed_twice_changes_nothing(
    api: AsyncClient, db_session: AsyncSession, engine: MettaRouteEngine
) -> None:
    demo = load_demo(DEMO_PATH)
    first_count = (await seed_and_reproject(db_session, engine, demo)).projected
    first = await _snapshot(db_session)

    second_count = (await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))).projected

    assert await _snapshot(db_session) == first
    assert second_count == first_count


async def test_a_real_clerk_sign_up_is_never_touched(
    api: AsyncClient,
    db_session: AsyncSession,
    engine: MettaRouteEngine,
    confirmed_builder: Actor,
    pending_builder: Actor,
    briefs: dict[str, VentureBrief],
) -> None:
    real = [
        await _rows_of(db_session, confirmed_builder),
        await _rows_of(db_session, pending_builder),
    ]
    await reproject(engine, db_session)
    before = _routes(engine, briefs)

    await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))
    await seed_and_reproject(db_session, engine, load_demo(DEMO_PATH))

    assert [
        await _rows_of(db_session, confirmed_builder),
        await _rows_of(db_session, pending_builder),
    ] == real
    assert _routes(engine, briefs) == before


def test_a_missing_demo_file_exits_non_zero(tmp_path: Path) -> None:
    assert main(["--file", str(tmp_path / "absent.json")]) != 0


def test_the_demo_file_validates_ids_and_links() -> None:
    demo = load_demo(DEMO_PATH)
    assert [entry.title for entry in demo.entries] == EXPECTED_TITLES
    assert [entry.owner.builder_id for entry in demo.entries][0] == "demo-njuguna-njenga"
    for entry in demo.entries:
        assert "mobile" not in entry.skills
        assert isinstance(UUID(str(entry.project_id)), UUID)


def test_the_demo_file_refuses_invented_facts_about_the_operator(tmp_path: Path) -> None:
    raw = json.loads(DEMO_PATH.read_text(encoding="utf-8"))
    raw["entries"][0]["owner"]["cohort"] = "cohort-2025c"
    path = tmp_path / "invented.json"
    path.write_text(json.dumps(raw), encoding="utf-8")

    with pytest.raises(SeedError, match="cohort"):
        load_demo(path)
