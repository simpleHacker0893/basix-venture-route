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
from collections.abc import AsyncIterator, Callable, Iterator
from typing import Any

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
async def api(marketplace_app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with (
        marketplace_app.router.lifespan_context(marketplace_app),
        AsyncClient(
            transport=ASGITransport(app=marketplace_app), base_url="http://testserver"
        ) as client,
    ):
        yield client


@pytest.fixture
def bearer(test_keys: SigningKeys) -> Callable[..., dict[str, str]]:
    """`bearer(sub="user_1", role="builder")` → the Authorization header for that session."""

    def _bearer(**kwargs: Any) -> dict[str, str]:
        return {"Authorization": f"Bearer {sign_jwt(test_keys, **kwargs)}"}

    return _bearer
