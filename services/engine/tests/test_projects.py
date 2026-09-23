"""Seam: HTTP /api/me/credentials and /api/me/projects with a fake Clerk JWT (D-19, spec #35
§Marketplace API). Acceptance: "one credential, one project (licensable)". Both are pending
until an admin confirms them (#42), so the profile skill shape stays self-described here.
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.test_me_profile import profile_input

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


async def _builder_with_profile(
    api: AsyncClient, session: AsyncSession, bearer: Bearer, clerk_id: str = "user_b"
) -> dict[str, str]:
    session.add(User(clerk_id=clerk_id, email=f"{clerk_id}@example.com", role="builder"))
    await session.commit()
    headers = bearer(sub=clerk_id, role="builder")
    saved = await api.put("/api/me/profile", json=profile_input(), headers=headers)
    assert saved.status_code == 200
    return headers


def credential_input(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Python 201",
        "issuer": "MeTTa OmniUniversity",
        "skillId": "python",
    }
    body.update(overrides)
    return body


def project_input(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Clinic triage intake flow",
        "vertical": "health",
        "licensable": True,
        "completedOn": "2026-08-12",
        "skillIds": ["python", "ui-ux"],
    }
    body.update(overrides)
    return body


# -- credentials ----------------------------------------


async def test_credential_is_created_pending_and_listed(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)

    created = await api.post("/api/me/credentials", json=credential_input(), headers=headers)
    listed = await api.get("/api/me/credentials", headers=headers)

    assert created.status_code == 201
    body = created.json()
    assert body["id"]
    assert {k: body[k] for k in ("title", "issuer", "skillId", "status", "demoData")} == {
        "title": "Python 201",
        "issuer": "MeTTa OmniUniversity",
        "skillId": "python",
        "status": "pending",
        "demoData": True,
    }
    assert listed.status_code == 200
    assert listed.json() == [body]


async def test_pending_credential_does_not_verify_the_skill(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)
    await api.post("/api/me/credentials", json=credential_input(), headers=headers)

    profile = await api.get("/api/me/profile", headers=headers)

    python = next(skill for skill in profile.json()["skills"] if skill["id"] == "python")
    assert python == {
        "id": "python",
        "name": "Python",
        "status": "self-described",
        "evidence": None,
    }


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"skillId": "cobol"}, "skillId"),
        ({"title": ""}, "title"),
        ({"issuer": ""}, "issuer"),
    ],
)
async def test_invalid_credential_is_422(
    api: AsyncClient,
    bearer: Bearer,
    db_session: AsyncSession,
    override: dict[str, Any],
    fragment: str,
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)

    response = await api.post(
        "/api/me/credentials", json=credential_input(**override), headers=headers
    )

    assert response.status_code == 422
    assert fragment in response.json()["message"]


# -- projects ----------------------------------------


async def test_project_is_created_pending_and_listed(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)

    created = await api.post("/api/me/projects", json=project_input(), headers=headers)
    listed = await api.get("/api/me/projects", headers=headers)

    assert created.status_code == 201
    body = created.json()
    assert body["id"]
    assert {
        k: body[k] for k in ("title", "vertical", "licensable", "completedOn", "skillIds", "status")
    } == {
        "title": "Clinic triage intake flow",
        "vertical": "health",
        "licensable": True,
        "completedOn": "2026-08-12",
        "skillIds": ["python", "ui-ux"],
        "status": "pending",
    }
    assert body["demoData"] is True
    assert listed.json() == [body]


async def test_pending_project_does_not_verify_its_skills(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)
    await api.post("/api/me/projects", json=project_input(), headers=headers)

    profile = await api.get("/api/me/profile", headers=headers)

    assert all(skill["status"] == "self-described" for skill in profile.json()["skills"])
    assert [skill["id"] for skill in profile.json()["skills"]] == ["python", "backend"]


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"skillIds": []}, "skillIds"),
        ({"skillIds": ["python", "rust", "data", "mobile", "backend", "frontend"]}, "skillIds"),
        ({"skillIds": ["cobol"]}, "skillIds"),
        ({"vertical": "fintech"}, "vertical"),
        ({"completedOn": "12/08/2026"}, "completedOn"),
        ({"title": ""}, "title"),
    ],
)
async def test_invalid_project_is_422(
    api: AsyncClient,
    bearer: Bearer,
    db_session: AsyncSession,
    override: dict[str, Any],
    fragment: str,
) -> None:
    headers = await _builder_with_profile(api, db_session, bearer)

    response = await api.post("/api/me/projects", json=project_input(**override), headers=headers)

    assert response.status_code == 422
    assert fragment in response.json()["message"]


# -- guards ----------------------------------------


async def test_proof_needs_a_profile_first(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    db_session.add(User(clerk_id="user_np", email="np@example.com", role="builder"))
    await db_session.commit()
    headers = bearer(sub="user_np", role="builder")

    credential = await api.post("/api/me/credentials", json=credential_input(), headers=headers)
    project = await api.post("/api/me/projects", json=project_input(), headers=headers)

    assert credential.status_code == 404
    assert project.status_code == 404


async def test_proof_routes_are_builder_only(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    db_session.add(User(clerk_id="user_f", email="f@example.com", role="founder"))
    await db_session.commit()
    headers = bearer(sub="user_f", role="founder")

    assert (await api.get("/api/me/credentials", headers=headers)).status_code == 403
    assert (await api.get("/api/me/projects", headers=headers)).status_code == 403


async def test_builders_only_see_their_own_rows(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    mine = await _builder_with_profile(api, db_session, bearer, "user_one")
    theirs = await _builder_with_profile(api, db_session, bearer, "user_two")
    await api.post("/api/me/credentials", json=credential_input(), headers=mine)

    assert len((await api.get("/api/me/credentials", headers=mine)).json()) == 1
    assert (await api.get("/api/me/credentials", headers=theirs)).json() == []
