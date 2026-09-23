"""Seam: HTTP POST /api/webhooks/clerk with Svix-signed payloads (D-03, D-19, spec #35 §Webhook).

Acceptance: "`ADMIN_EMAILS` bootstrap test: a webhook `user.created` for a listed email yields
role `admin`, `confirmed = true`; webhook with a bad signature → 400." Requirements edge case:
"Webhook replay → idempotent upsert."
"""

import time

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.clerk import JwksCache
from app.config import Settings
from app.engine.metta_engine import MettaRouteEngine
from app.marketplace.models import User
from tests.auth_fixtures import TEST_JWKS_URL, SigningKeys, clerk_user_event, svix_headers
from tests.conftest import FakeClerkAdmin

pytestmark = pytest.mark.anyio

WEBHOOK = "/api/webhooks/clerk"


async def _users(session: AsyncSession) -> list[User]:
    return list((await session.exec(select(User).order_by(User.email))).all())


async def test_signed_user_created_upserts_a_pending_user(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    body = clerk_user_event(
        "user.created", clerk_id="user_a", email="a@example.com", role="builder"
    )

    response = await api.post(WEBHOOK, content=body, headers=svix_headers(body))

    assert response.status_code == 200
    assert response.json() == {
        "handled": True,
        "clerk_id": "user_a",
        "role": "builder",
        "confirmed": False,
    }
    (user,) = await _users(db_session)
    assert (user.clerk_id, user.email, user.role, user.status) == (
        "user_a",
        "a@example.com",
        "builder",
        "pending",
    )


async def test_replayed_event_is_idempotent(api: AsyncClient, db_session: AsyncSession) -> None:
    body = clerk_user_event(
        "user.created", clerk_id="user_a", email="a@example.com", role="builder"
    )
    headers = svix_headers(body)

    first = await api.post(WEBHOOK, content=body, headers=headers)
    second = await api.post(WEBHOOK, content=body, headers=headers)

    assert (first.status_code, second.status_code) == (200, 200)
    assert len(await _users(db_session)) == 1


async def test_user_updated_changes_email_and_role(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    created = clerk_user_event("user.created", clerk_id="user_a", email="a@example.com")
    updated = clerk_user_event(
        "user.updated", clerk_id="user_a", email="new@example.com", role="founder"
    )

    await api.post(WEBHOOK, content=created, headers=svix_headers(created, msg_id="msg_1"))
    response = await api.post(
        WEBHOOK, content=updated, headers=svix_headers(updated, msg_id="msg_2")
    )

    assert response.status_code == 200
    (user,) = await _users(db_session)
    assert (user.email, user.role) == ("new@example.com", "founder")


async def test_admin_email_bootstraps_a_confirmed_admin(
    api: AsyncClient, db_session: AsyncSession, clerk_admin: FakeClerkAdmin
) -> None:
    """ADMIN_EMAILS is matched case-insensitively; the role is written back to Clerk (D-03)."""
    body = clerk_user_event("user.created", clerk_id="user_ops", email="ADMIN@example.org")

    response = await api.post(WEBHOOK, content=body, headers=svix_headers(body))

    assert response.status_code == 200
    assert response.json() == {
        "handled": True,
        "clerk_id": "user_ops",
        "role": "admin",
        "confirmed": True,
    }
    (user,) = await _users(db_session)
    assert (user.role, user.status) == ("admin", "confirmed")
    assert clerk_admin.role_writes == [("user_ops", "admin")]


async def test_non_admin_email_never_becomes_admin_even_if_claimed(
    api: AsyncClient, db_session: AsyncSession, clerk_admin: FakeClerkAdmin
) -> None:
    """A user cannot promote themselves through public_metadata; only the list grants admin."""
    body = clerk_user_event("user.created", clerk_id="user_x", email="x@example.com", role="admin")

    response = await api.post(WEBHOOK, content=body, headers=svix_headers(body))

    assert response.status_code == 200
    (user,) = await _users(db_session)
    assert (user.role, user.status) == (None, "pending")
    assert clerk_admin.role_writes == []


async def test_unhandled_event_type_is_200_not_handled(
    api: AsyncClient, db_session: AsyncSession
) -> None:
    body = clerk_user_event("session.created", clerk_id="user_a", email="a@example.com")

    response = await api.post(WEBHOOK, content=body, headers=svix_headers(body))

    assert response.status_code == 200
    assert response.json() == {"handled": False}
    assert await _users(db_session) == []


@pytest.mark.parametrize(
    "spoil",
    ["wrong-secret", "stale-timestamp", "missing-signature", "missing-id", "tampered-body"],
)
async def test_bad_signature_is_400(api: AsyncClient, db_session: AsyncSession, spoil: str) -> None:
    body = clerk_user_event(
        "user.created", clerk_id="user_a", email="a@example.com", role="builder"
    )
    headers = svix_headers(body)
    if spoil == "wrong-secret":
        headers = svix_headers(
            body, secret="whsec_" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        )
    elif spoil == "stale-timestamp":
        headers = svix_headers(body, timestamp=int(time.time()) - 6 * 60)
    elif spoil == "missing-signature":
        del headers["svix-signature"]
    elif spoil == "missing-id":
        del headers["svix-id"]
    elif spoil == "tampered-body":
        body = body.replace(b"a@example.com", b"b@example.com")

    response = await api.post(WEBHOOK, content=body, headers=headers)

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid webhook signature"}
    assert await _users(db_session) == []


async def test_placeholder_secret_rejects_every_call(
    engine: MettaRouteEngine, test_keys: SigningKeys, session_factory: object
) -> None:
    """A placeholder CLERK_WEBHOOK_SIGNING_SECRET (D-26) can never accept an event."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.main import create_app

    assert isinstance(session_factory, async_sessionmaker)
    app = create_app(
        Settings(clerk_jwks_url=TEST_JWKS_URL, clerk_webhook_signing_secret="whsec_replace-me"),
        engine=engine,
        jwks_cache=JwksCache.preloaded(test_keys.jwks),
        session_factory=session_factory,
        clerk_admin=FakeClerkAdmin(),
    )
    body = clerk_user_event("user.created", clerk_id="user_a", email="a@example.com")
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client,
    ):
        response = await client.post(WEBHOOK, content=body, headers=svix_headers(body))

    assert response.status_code == 400
