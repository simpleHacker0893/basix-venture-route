"""Shared fixtures. Every test here runs the real Hyperon runtime (no mocks, D-19).

The suite runs with LLM_PROVIDER=null unless the environment says otherwise, so no test ever
reaches a language model; the Anthropic adapter is exercised with a fake transport (#17).

Marketplace tests (Sprint 003) run against TEST_DATABASE_URL: the schema is dropped and
`alembic upgrade head` runs once per session, then every test gets a session inside an outer
transaction that is rolled back at teardown. With TEST_DATABASE_URL unset or a placeholder those
tests skip, so the Sprint 001 and 002 suites still pass on a machine without a database.
"""

import asyncio
import os
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

os.environ.setdefault("LLM_PROVIDER", "null")

from app.auth.clerk import JwksCache  # noqa: E402
from app.config import PACKAGE_ROOT, Settings, get_settings  # noqa: E402
from app.engine.metta_engine import MettaRouteEngine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.marketplace.models import User  # noqa: E402
from app.models.brief import VentureBrief, load_seed_briefs  # noqa: E402
from tests.auth_fixtures import (  # noqa: E402
    TEST_JWKS_URL,
    TEST_WEBHOOK_SECRET,
    SigningKeys,
    generate_test_keys,
    sign_jwt,
)

TEST_ADMIN_EMAILS = "ops@basix.example, Admin@Example.org"


class FakeClerkAdmin:
    """Stands in for the Clerk Backend API (D-03): records every publicMetadata.role write."""

    def __init__(self) -> None:
        self.role_writes: list[tuple[str, str]] = []

    async def set_role(self, clerk_id: str, role: str) -> None:
        self.role_writes.append((clerk_id, role))


@pytest.fixture(scope="session")
def engine() -> MettaRouteEngine:
    return MettaRouteEngine(get_settings())


@pytest.fixture(scope="session")
def briefs() -> dict[str, VentureBrief]:
    return {brief.id: brief for brief in load_seed_briefs(get_settings().seed_dir / "briefs.json")}


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


# -- marketplace store (Sprint 003) ---------------------------------------------------------------


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = get_settings().test_database_url
    if url is None:
        pytest.skip("TEST_DATABASE_URL is unset or a placeholder; marketplace tests need Postgres")
    return url


async def _reset_schema(url: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("DROP SCHEMA public CASCADE"))
            await connection.execute(text("CREATE SCHEMA public"))
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def migrated_database(test_database_url: str) -> str:
    """Empty database → `alembic upgrade head`, once per session. Proves the clean upgrade."""
    from alembic import command
    from alembic.config import Config

    asyncio.run(_reset_schema(test_database_url))
    os.environ["ALEMBIC_DATABASE_URL"] = test_database_url
    command.upgrade(Config(str(PACKAGE_ROOT / "alembic.ini")), "head")
    return test_database_url


@pytest.fixture
async def db_connection(migrated_database: str) -> AsyncIterator[AsyncConnection]:
    engine = create_async_engine(migrated_database)
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()
            try:
                yield connection
            finally:
                await transaction.rollback()
    finally:
        await engine.dispose()


@pytest.fixture
def session_factory(db_connection: AsyncConnection) -> async_sessionmaker[AsyncSession]:
    """Sessions bound to the test connection; commits become savepoints inside the outer
    transaction, so route handlers can commit and the test still rolls everything back."""
    return async_sessionmaker(
        bind=db_connection,
        class_=AsyncSession,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )


@pytest.fixture
async def db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


# -- marketplace app: fake Clerk JWKS, injected store, no network (Sprint 003, D-19) ---------------


@pytest.fixture(scope="session")
def test_keys() -> SigningKeys:
    return generate_test_keys()


@pytest.fixture
def marketplace_settings() -> Settings:
    """Settings for the app under test: the fake JWKS issuer, the test webhook secret and the
    test admin emails; everything else from the env."""
    return Settings(
        clerk_jwks_url=TEST_JWKS_URL,
        clerk_webhook_signing_secret=TEST_WEBHOOK_SECRET,
        admin_emails=TEST_ADMIN_EMAILS,
    )


@pytest.fixture
def clerk_admin() -> FakeClerkAdmin:
    return FakeClerkAdmin()


@pytest.fixture
def marketplace_app(
    engine: MettaRouteEngine,
    marketplace_settings: Settings,
    test_keys: SigningKeys,
    session_factory: async_sessionmaker[AsyncSession],
    clerk_admin: FakeClerkAdmin,
) -> FastAPI:
    """The real app with the engine shared, the JWKS cache preloaded, the store bound to the
    rolled-back test connection and a fake Clerk Backend client. Nothing is patched; every
    override enters through create_app."""
    return create_app(
        marketplace_settings,
        engine=engine,
        jwks_cache=JwksCache.preloaded(test_keys.jwks),
        session_factory=session_factory,
        clerk_admin=clerk_admin,
    )


@pytest.fixture
async def api(marketplace_app: FastAPI, engine: MettaRouteEngine) -> AsyncIterator[AsyncClient]:
    """The app over ASGI with its lifespan. The session-scoped engine is shared with the Sprint
    001 tests, so after each marketplace test its space goes back to seed facts only."""
    try:
        async with (
            marketplace_app.router.lifespan_context(marketplace_app),
            AsyncClient(
                transport=ASGITransport(app=marketplace_app), base_url="http://testserver"
            ) as client,
        ):
            yield client
    finally:
        engine.replace_space("")


@pytest.fixture
def bearer(test_keys: SigningKeys) -> Callable[..., dict[str, str]]:
    """`bearer(sub="user_1", role="builder")` → the Authorization header for that session."""

    def _bearer(**kwargs: Any) -> dict[str, str]:
        return {"Authorization": f"Bearer {sign_jwt(test_keys, **kwargs)}"}

    return _bearer


# -- the marketplace cast (Sprint 004, #55): founder, admin, and three builders -------------------
#
# Every requests, bids, bookings and dashboard test needs the same people. Builders are entered
# through the HTTP seam (profile, credential, project) exactly as a signed-in builder would; an
# admin decision is the repository's decide flow followed by one reprojection, the same steps
# `POST /api/admin/confirm` takes minus the per-call rebuild. The confirmed builder is verified
# for `mobile` only and available 2026-09-22 → 2026-10-20 remote, so `eligible-builder` holds for
# her on the seed Constrained brief (mobile + rust, remote, 2026-09-22 → 2026-10-06) and never on
# the Health brief.


@dataclass(frozen=True)
class Actor:
    """One signed-in person: the bearer header, the users row id and, for builders, the profile
    slug plus the ids of the rows an admin decides on (`account`, `credential`, `project`)."""

    clerk_id: str
    role: str
    headers: dict[str, str]
    user_id: UUID
    builder_id: str | None = None
    ids: dict[str, str] = field(default_factory=dict)


CONSTRAINED_BRIEF_ID = "brief-constrained-01"

# Builders in the cast, display name → (clerk id, email). Slugs never collide with seed ids.
BUILDER_CAST = {
    "Naomi Chebet": ("user_naomi", "naomi@example.com"),
    "Kevin Mutua": ("user_kevin", "kevin@example.com"),
    "Esther Wanjala": ("user_esther", "esther@example.com"),
}


def builder_profile_input(display_name: str) -> dict[str, Any]:
    """A remote mobile builder available across the Constrained brief's window."""
    return {
        "displayName": display_name,
        "headline": "Mobile builder",
        "cohortId": None,
        "location": "Nairobi",
        "dayRate": 120,
        "modes": {"remote": True, "hybrid": False, "onSite": False},
        "selfDescribedSkills": ["mobile"],
        "phone": None,
        "linkedin": None,
        "sharing": {"email": True, "phone": False, "linkedin": False},
        "availability": [{"start": "2026-09-22", "end": "2026-10-20"}],
    }


MOBILE_CREDENTIAL = {"title": "Mobile 301", "issuer": "MeTTa OmniUniversity", "skillId": "mobile"}
MOBILE_PROJECT = {
    "title": "Field survey app",
    "vertical": "agri",
    "licensable": True,
    "completedOn": "2026-08-12",
    "skillIds": ["mobile"],
}


async def _user(
    session: AsyncSession, bearer: Callable[..., dict[str, str]], clerk_id: str, role: str
) -> Actor:
    row = User(
        clerk_id=clerk_id,
        email=f"{clerk_id.removeprefix('user_')}@example.com",
        role=role,
        status="confirmed" if role == "admin" else "pending",
    )
    session.add(row)
    await session.commit()
    return Actor(
        clerk_id=clerk_id, role=role, headers=bearer(sub=clerk_id, role=role), user_id=row.id
    )


async def _pending_builder(
    api: AsyncClient,
    session: AsyncSession,
    bearer: Callable[..., dict[str, str]],
    display_name: str,
) -> Actor:
    """A builder with a profile, one mobile credential and one mobile project, all pending."""
    clerk_id, _email = BUILDER_CAST[display_name]
    user = await _user(session, bearer, clerk_id, "builder")
    profile = await api.put(
        "/api/me/profile", json=builder_profile_input(display_name), headers=user.headers
    )
    assert profile.status_code == 200, profile.text
    credential = await api.post("/api/me/credentials", json=MOBILE_CREDENTIAL, headers=user.headers)
    project = await api.post("/api/me/projects", json=MOBILE_PROJECT, headers=user.headers)
    assert (credential.status_code, project.status_code) == (201, 201)
    return Actor(
        clerk_id=user.clerk_id,
        role="builder",
        headers=user.headers,
        user_id=user.user_id,
        builder_id=profile.json()["builderId"],
        ids={
            "account": str(user.user_id),
            "credential": credential.json()["id"],
            "project": project.json()["id"],
        },
    )


Decide = Callable[[Actor, dict[str, str]], Awaitable[int]]


@pytest.fixture
async def admin(db_session: AsyncSession, bearer: Callable[..., dict[str, str]]) -> Actor:
    return await _user(db_session, bearer, "user_admin", "admin")


@pytest.fixture
async def founder(db_session: AsyncSession, bearer: Callable[..., dict[str, str]]) -> Actor:
    return await _user(db_session, bearer, "user_founder", "founder")


@pytest.fixture
async def other_founder(db_session: AsyncSession, bearer: Callable[..., dict[str, str]]) -> Actor:
    return await _user(db_session, bearer, "user_founder_2", "founder")


@pytest.fixture
def decide(
    marketplace_app: FastAPI, engine: MettaRouteEngine, db_session: AsyncSession, admin: Actor
) -> Decide:
    """`await decide(builder, {"account": "confirmed", "project": "rejected"})`: the admin decide
    flow for each named row, committed, then one reprojection; returns the projected atom count."""
    from app.engine.projection import reproject
    from app.marketplace import repo

    async def _decide(builder: Actor, decisions: dict[str, str]) -> int:
        for kind, decision in decisions.items():
            found = await repo.decide(
                db_session, kind, UUID(builder.ids[kind]), decision, admin.user_id
            )
            assert found, f"no {kind} {builder.ids[kind]}"
        projected = await reproject(engine, db_session)
        marketplace_app.state.known_entities = engine.known_entities()
        return projected

    return _decide


@pytest.fixture
async def unconfirmed_builder(
    api: AsyncClient, db_session: AsyncSession, bearer: Callable[..., dict[str, str]]
) -> Actor:
    """Naomi Chebet, everything pending: no atoms, invisible to founders and the engine."""
    return await _pending_builder(api, db_session, bearer, "Naomi Chebet")


@pytest.fixture
async def confirmed_builder(unconfirmed_builder: Actor, decide: Decide) -> Actor:
    """Naomi Chebet with account, credential and project confirmed: eligible for the Constrained
    brief's `mobile` skill with evidence `both`."""
    await decide(
        unconfirmed_builder,
        {"account": "confirmed", "credential": "confirmed", "project": "confirmed"},
    )
    return unconfirmed_builder


@pytest.fixture
async def pending_builder(
    api: AsyncClient, db_session: AsyncSession, bearer: Callable[..., dict[str, str]]
) -> Actor:
    """Kevin Mutua, a second all-pending builder for tests that need two of them."""
    return await _pending_builder(api, db_session, bearer, "Kevin Mutua")


@pytest.fixture
async def rejected_builder(
    api: AsyncClient,
    db_session: AsyncSession,
    bearer: Callable[..., dict[str, str]],
    decide: Decide,
) -> Actor:
    """Esther Wanjala: account and credential confirmed, project rejected, so `mobile` is proven
    by the credential alone and the rejected project never reaches the graph."""
    builder = await _pending_builder(api, db_session, bearer, "Esther Wanjala")
    await decide(
        builder, {"account": "confirmed", "credential": "confirmed", "project": "rejected"}
    )
    return builder
