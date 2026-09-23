"""Seam: HTTP endpoints under /api/me/* and /api/admin/* with a fake Clerk JWT signed by the test
JWKS (D-03, D-19, spec #35 §Authentication).

Acceptance: "a builder gets 403 on `/api/admin/pending`"; requirements edge case: "Expired or
wrong-issuer JWT → 401, never a 500". The routes themselves are tracer stubs here (#38); tickets
#40 and #42 give them their bodies.
"""

from collections.abc import Callable
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import JwksCache
from app.config import Settings
from app.main import create_app
from app.marketplace.models import User
from tests.auth_fixtures import TEST_JWKS_URL, SigningKeys, generate_test_keys

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


async def _user(session: AsyncSession, clerk_id: str, role: str) -> User:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com", role=role)
    session.add(user)
    await session.commit()
    return user


async def test_no_token_is_401(api: AsyncClient) -> None:
    response = await api.get("/api/me/profile")

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid session"}


@pytest.mark.parametrize("header", ["Bearer nonsense", "Basic abc", "Bearer ", "Token x.y.z"])
async def test_malformed_authorization_is_401(api: AsyncClient, header: str) -> None:
    response = await api.get("/api/me/profile", headers={"Authorization": header})

    assert response.status_code == 401


async def test_expired_token_is_401(api: AsyncClient, bearer: Bearer) -> None:
    headers = bearer(sub="user_expired", role="builder", expires_in=timedelta(minutes=-5))

    response = await api.get("/api/me/profile", headers=headers)

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid session"}


async def test_wrong_issuer_is_401(api: AsyncClient, bearer: Bearer) -> None:
    headers = bearer(sub="user_x", role="builder", issuer="https://evil.example.com")

    response = await api.get("/api/me/profile", headers=headers)

    assert response.status_code == 401


async def test_unknown_key_id_is_401(api: AsyncClient, bearer: Bearer) -> None:
    headers = bearer(sub="user_x", role="builder", kid="rotated-away")

    response = await api.get("/api/me/profile", headers=headers)

    assert response.status_code == 401


async def test_token_signed_by_another_key_is_401(api: AsyncClient) -> None:
    other = generate_test_keys(kid="test-key-1")  # same kid, different private key
    from tests.auth_fixtures import sign_jwt

    headers = {"Authorization": f"Bearer {sign_jwt(other, sub='user_x', role='builder')}"}

    response = await api.get("/api/me/profile", headers=headers)

    assert response.status_code == 401


async def test_verified_token_without_user_row_is_403(api: AsyncClient, bearer: Bearer) -> None:
    """The webhook has not created the row yet: only the role endpoint accepts this state."""
    response = await api.get("/api/me/profile", headers=bearer(sub="user_new", role="builder"))

    assert response.status_code == 403


async def test_builder_reaches_me_routes(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_builder", "builder")

    response = await api.get("/api/me/profile", headers=bearer(sub="user_builder", role="builder"))

    # Tracer stub until #40: a builder with no profile yet gets 404, not 401/403/500.
    assert response.status_code == 404


async def test_builder_gets_403_on_admin_pending(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_builder", "builder")

    response = await api.get(
        "/api/admin/pending", headers=bearer(sub="user_builder", role="builder")
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "role admin required"}


async def test_founder_gets_403_on_me_routes(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_founder", "founder")

    response = await api.get("/api/me/profile", headers=bearer(sub="user_founder", role="founder"))

    assert response.status_code == 403
    assert response.json() == {"detail": "role builder required"}


async def test_missing_role_claim_is_403(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_noroledb", "builder")

    response = await api.get("/api/me/profile", headers=bearer(sub="user_noroledb", role=None))

    assert response.status_code == 403


async def test_admin_reaches_admin_pending(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_admin", "admin")

    response = await api.get("/api/admin/pending", headers=bearer(sub="user_admin", role="admin"))

    assert response.status_code == 200
    assert response.json() == {"accounts": [], "credentials": [], "projects": []}


async def test_placeholder_jwks_url_is_401_never_500(
    engine: object, session_factory: object, bearer: Bearer
) -> None:
    """Placeholder CLERK_JWKS_URL (D-26): empty cache, nothing to fetch, every gated route 401."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.engine.metta_engine import MettaRouteEngine

    assert isinstance(engine, MettaRouteEngine)
    assert isinstance(session_factory, async_sessionmaker)
    app: FastAPI = create_app(
        Settings(clerk_jwks_url="https://YOUR-INSTANCE.clerk.accounts.dev/.well-known/jwks.json"),
        engine=engine,
        jwks_cache=JwksCache.empty(),
        session_factory=session_factory,
    )
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client,
    ):
        response = await client.get("/api/me/profile", headers=bearer(sub="u", role="builder"))

    assert response.status_code == 401


async def test_store_not_configured_is_503(
    engine: object, test_keys: SigningKeys, bearer: Bearer
) -> None:
    """Placeholder DATABASE_URL (D-26): routing works, marketplace routes answer 503."""
    from app.engine.metta_engine import MettaRouteEngine

    assert isinstance(engine, MettaRouteEngine)
    app: FastAPI = create_app(
        Settings(clerk_jwks_url=TEST_JWKS_URL, database_url=None),
        engine=engine,
        jwks_cache=JwksCache.preloaded(test_keys.jwks),
        session_factory=None,
    )
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client,
    ):
        health = await client.get("/health")
        gated = await client.get("/api/me/profile", headers=bearer(sub=uuid4().hex, role="builder"))

    assert health.status_code == 200
    assert gated.status_code == 503
    assert gated.json() == {"detail": "marketplace store not configured"}


async def test_cors_allows_authorization_header_with_credentials(api: AsyncClient) -> None:
    """D-30: Sprint 003 turns credentials on for the Clerk bearer header."""
    response = await api.options(
        "/api/me/profile",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert "PUT" in response.headers["access-control-allow-methods"]


async def test_unknown_key_ids_refetch_the_jwks_at_most_once_per_interval(
    engine: object, session_factory: object, test_keys: SigningKeys, bearer: Bearer
) -> None:
    """A stream of tokens with bogus key ids must not become a fetch amplifier against Clerk:
    the cache refetches once per interval, and every such token still answers 401 (review of #38)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.engine.metta_engine import MettaRouteEngine

    assert isinstance(engine, MettaRouteEngine)
    assert isinstance(session_factory, async_sessionmaker)
    fetches = 0

    async def counting_fetch() -> dict[str, object]:
        nonlocal fetches
        fetches += 1
        return test_keys.jwks

    cache = JwksCache(fetch=counting_fetch)
    app: FastAPI = create_app(
        Settings(clerk_jwks_url=TEST_JWKS_URL),
        engine=engine,
        jwks_cache=cache,
        session_factory=session_factory,
    )
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client,
    ):
        after_startup = fetches
        statuses = [
            (
                await client.get(
                    "/api/me/profile", headers=bearer(sub="u", role="builder", kid=f"bogus-{i}")
                )
            ).status_code
            for i in range(5)
        ]

    assert statuses == [401] * 5
    assert fetches - after_startup == 1
