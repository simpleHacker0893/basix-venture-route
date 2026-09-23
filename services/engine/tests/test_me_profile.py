"""Seam: HTTP /api/me/role and /api/me/profile with a fake Clerk JWT (D-19, spec #35 §Marketplace
API). Acceptance: "Builder creates a profile with availability" (API half) and "Self-described
skill on a profile ... never verified" (API status). Slug identity per D-24 and the brainstorming
decision: a slug from the display name, collision-suffixed, immutable.
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.conftest import FakeClerkAdmin

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


async def _user(session: AsyncSession, clerk_id: str, role: str | None = "builder") -> User:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com", role=role)
    session.add(user)
    await session.commit()
    return user


def profile_input(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "displayName": "Jane Mwangi",
        "headline": "Backend builder",
        "cohortId": "cohort-2026a",
        "location": "Nairobi",
        "dayRate": 140,
        "modes": {"remote": True, "hybrid": True, "onSite": False},
        "selfDescribedSkills": ["python", "backend"],
        "phone": "+254700000000",
        "linkedin": "linkedin.com/in/jane-mwangi",
        "sharing": {"email": True, "phone": False, "linkedin": True},
        "availability": [{"start": "2026-09-22", "end": "2026-10-20"}],
    }
    body.update(overrides)
    return body


# -- POST /api/me/role ----------------------------------------------------------------------------


async def test_role_is_chosen_once_and_written_to_clerk(
    api: AsyncClient, bearer: Bearer, clerk_admin: FakeClerkAdmin
) -> None:
    """A verified token without a users row (webhook not arrived yet) may still choose a role."""
    headers = bearer(sub="user_new", role=None)

    first = await api.post("/api/me/role", json={"role": "builder"}, headers=headers)
    second = await api.post("/api/me/role", json={"role": "founder"}, headers=headers)

    assert first.status_code == 200
    assert first.json() == {"clerkId": "user_new", "role": "builder", "confirmed": False}
    assert second.status_code == 409
    assert clerk_admin.role_writes == [("user_new", "builder")]


async def test_role_endpoint_keeps_the_webhook_email(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_wh", role=None)

    response = await api.post(
        "/api/me/role", json={"role": "founder"}, headers=bearer(sub="user_wh", role=None)
    )

    assert response.status_code == 200
    user = await _find(db_session, "user_wh")
    assert (user.email, user.role) == ("user_wh@example.com", "founder")


async def _find(session: AsyncSession, clerk_id: str) -> User:
    from sqlmodel import select

    user = (await session.exec(select(User).where(User.clerk_id == clerk_id))).one()
    await session.refresh(user)
    return user


@pytest.mark.parametrize("role", ["admin", "judge", ""])
async def test_role_endpoint_refuses_non_user_roles(
    api: AsyncClient, bearer: Bearer, role: str
) -> None:
    response = await api.post(
        "/api/me/role", json={"role": role}, headers=bearer(sub="user_new", role=None)
    )

    assert response.status_code == 422


async def test_role_endpoint_needs_a_verified_token(api: AsyncClient) -> None:
    response = await api.post("/api/me/role", json={"role": "builder"})

    assert response.status_code == 401


# -- GET / PUT /api/me/profile ---------------------------------------------------------------------


async def test_profile_is_404_before_the_first_save(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_b")

    response = await api.get("/api/me/profile", headers=bearer(sub="user_b", role="builder"))

    assert response.status_code == 404


async def test_put_creates_the_profile_with_a_slug_and_self_described_skills(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_b")
    headers = bearer(sub="user_b", role="builder")

    response = await api.put("/api/me/profile", json=profile_input(), headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["builderId"] == "jane-mwangi"
    assert body["displayName"] == "Jane Mwangi"
    assert body["cohortId"] == "cohort-2026a"
    assert body["location"] == "Nairobi"
    assert body["dayRate"] == 140
    assert body["modes"] == {"remote": True, "hybrid": True, "onSite": False}
    assert body["availability"] == [{"start": "2026-09-22", "end": "2026-10-20"}]
    assert body["contact"] == {
        "email": "user_b@example.com",
        "phone": "+254700000000",
        "linkedin": "linkedin.com/in/jane-mwangi",
    }
    assert body["sharing"] == {"email": True, "phone": False, "linkedin": True}
    # Self-described skills are display only: never verified, never with evidence.
    assert body["skills"] == [
        {"id": "python", "name": "Python", "status": "self-described", "evidence": None},
        {"id": "backend", "name": "Backend", "status": "self-described", "evidence": None},
    ]
    assert body["accountStatus"] == "pending"
    assert body["confirmed"] is False
    assert body["demoData"] is True

    again = await api.get("/api/me/profile", headers=headers)
    assert again.status_code == 200
    assert again.json() == body


async def test_put_replaces_fields_and_availability_but_never_the_slug(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_b")
    headers = bearer(sub="user_b", role="builder")
    await api.put("/api/me/profile", json=profile_input(), headers=headers)

    response = await api.put(
        "/api/me/profile",
        json=profile_input(
            displayName="Jane W. Mwangi",
            dayRate=160,
            selfDescribedSkills=["rust"],
            availability=[
                {"start": "2026-10-01", "end": "2026-10-05"},
                {"start": "2026-11-01", "end": "2026-11-30"},
            ],
        ),
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["builderId"] == "jane-mwangi"
    assert body["displayName"] == "Jane W. Mwangi"
    assert body["dayRate"] == 160
    assert [skill["id"] for skill in body["skills"]] == ["rust"]
    assert body["availability"] == [
        {"start": "2026-10-01", "end": "2026-10-05"},
        {"start": "2026-11-01", "end": "2026-11-30"},
    ]


async def test_slug_collisions_get_a_numeric_suffix_including_seed_builders(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_1")
    await _user(db_session, "user_2")
    await _user(db_session, "user_3")

    first = await api.put(
        "/api/me/profile", json=profile_input(), headers=bearer(sub="user_1", role="builder")
    )
    second = await api.put(
        "/api/me/profile", json=profile_input(), headers=bearer(sub="user_2", role="builder")
    )
    seed_clash = await api.put(
        "/api/me/profile",
        json=profile_input(displayName="Amina Otieno"),
        headers=bearer(sub="user_3", role="builder"),
    )

    assert first.json()["builderId"] == "jane-mwangi"
    assert second.json()["builderId"] == "jane-mwangi-2"
    # amina-otieno is a seed builder in facts.metta; a user-entered builder may never take it.
    assert seed_clash.json()["builderId"] == "amina-otieno-2"


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"dayRate": 0}, "dayRate"),
        ({"modes": {"remote": False, "hybrid": False, "onSite": False}}, "modes"),
        ({"selfDescribedSkills": ["cobol"]}, "selfDescribedSkills"),
        ({"cohortId": "cohort-1999z"}, "cohortId"),
        ({"availability": [{"start": "2026-10-20", "end": "2026-10-01"}]}, "availability"),
        ({"displayName": "   "}, "displayName"),
        ({"displayName": "!!!"}, "displayName"),
    ],
)
async def test_invalid_profile_input_is_422_with_the_field_named(
    api: AsyncClient,
    bearer: Bearer,
    db_session: AsyncSession,
    override: dict[str, Any],
    fragment: str,
) -> None:
    await _user(db_session, "user_b")

    response = await api.put(
        "/api/me/profile",
        json=profile_input(**override),
        headers=bearer(sub="user_b", role="builder"),
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert fragment in response.json()["message"]


async def test_profile_routes_are_builder_only(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    await _user(db_session, "user_f", role="founder")

    response = await api.put(
        "/api/me/profile", json=profile_input(), headers=bearer(sub="user_f", role="founder")
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("display_name", "expected"),
    [
        ("Python", "python-2"),  # a skill id
        ("Remote", "remote-2"),  # a delivery mode
        ("Nairobi", "nairobi-2"),  # a seed location slug
        ("Credential", "credential-2"),  # an evidence symbol
        ("2026", "b-2026"),  # a leading digit would parse as a MeTTa number
    ],
)
async def test_slug_never_takes_a_seed_vocabulary_symbol(
    api: AsyncClient,
    bearer: Bearer,
    db_session: AsyncSession,
    display_name: str,
    expected: str,
) -> None:
    """Builder slugs share one untyped atom namespace with skills, modes, locations and evidence
    symbols; taking one would corrupt the projection (review of #40)."""
    await _user(db_session, "user_v")

    response = await api.put(
        "/api/me/profile",
        json=profile_input(displayName=display_name),
        headers=bearer(sub="user_v", role="builder"),
    )

    assert response.status_code == 200
    assert response.json()["builderId"] == expected


async def test_role_is_not_stored_when_the_clerk_write_fails_and_a_retry_succeeds(
    api: AsyncClient, bearer: Bearer, clerk_admin: FakeClerkAdmin
) -> None:
    """Clerk is written before the local commit: a Backend API failure answers 502 and stores no
    role, so the retry is not a 409 and the session claim never lags the row (review, #40)."""
    original = clerk_admin.set_role

    async def failing(clerk_id: str, role: str) -> None:
        raise RuntimeError("clerk backend unavailable")

    clerk_admin.set_role = failing  # type: ignore[method-assign]
    headers = bearer(sub="user_flaky", role=None)

    failed = await api.post("/api/me/role", json={"role": "builder"}, headers=headers)
    clerk_admin.set_role = original  # type: ignore[method-assign]
    retried = await api.post("/api/me/role", json={"role": "builder"}, headers=headers)

    assert failed.status_code == 502
    assert retried.status_code == 200
    assert retried.json()["role"] == "builder"
    assert clerk_admin.role_writes == [("user_flaky", "builder")]
