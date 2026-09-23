"""Seam: HTTP GET /api/builders/{builder_id} with a fake founder or admin JWT (D-19, spec #35
§Marketplace API). Should: "Contact-sharing toggles honoured on the founder's candidate view."
DOMAIN.md §Marketplace rules: an account is invisible until an admin confirms it.
"""

from collections.abc import Callable

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.test_me_profile import profile_input
from tests.test_projects import credential_input, project_input

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


async def _role(session: AsyncSession, bearer: Bearer, clerk_id: str, role: str) -> dict[str, str]:
    session.add(
        User(clerk_id=clerk_id, email=f"{clerk_id}@example.com", role=role, status="confirmed")
    )
    await session.commit()
    return bearer(sub=clerk_id, role=role)


async def _builder(
    api: AsyncClient, session: AsyncSession, bearer: Bearer, **profile_overrides: object
) -> tuple[str, dict[str, str]]:
    """A pending builder with a profile, one credential and one project; returns the account id."""
    session.add(User(clerk_id="user_b", email="jane@example.com", role="builder"))
    await session.commit()
    headers = bearer(sub="user_b", role="builder")
    assert (
        await api.put("/api/me/profile", json=profile_input(**profile_overrides), headers=headers)
    ).status_code == 200
    credential = await api.post("/api/me/credentials", json=credential_input(), headers=headers)
    project = await api.post("/api/me/projects", json=project_input(), headers=headers)
    user = (await session.exec(select(User).where(User.clerk_id == "user_b"))).one()
    return str(user.id), {"credential": credential.json()["id"], "project": project.json()["id"]}


async def test_unconfirmed_builder_is_invisible_to_founders(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    founder = await _role(db_session, bearer, "user_f", "founder")
    await _builder(api, db_session, bearer)

    response = await api.get("/api/builders/jane-mwangi", headers=founder)

    assert response.status_code == 404


async def test_confirmed_builder_shows_verified_skills_projects_and_shared_contact_only(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    founder = await _role(db_session, bearer, "user_f", "founder")
    admin = await _role(db_session, bearer, "user_admin", "admin")
    account_id, ids = await _builder(api, db_session, bearer)
    await api.post(f"/api/admin/confirm/account/{account_id}", headers=admin)
    await api.post(f"/api/admin/confirm/credential/{ids['credential']}", headers=admin)
    await api.post(f"/api/admin/confirm/project/{ids['project']}", headers=admin)

    response = await api.get("/api/builders/jane-mwangi", headers=founder)

    assert response.status_code == 200
    body = response.json()
    assert body["builderId"] == "jane-mwangi"
    assert body["displayName"] == "Jane Mwangi"
    assert body["cohortId"] == "cohort-2026a"
    assert body["dayRate"] == 140
    assert body["modes"] == {"remote": True, "hybrid": True, "onSite": False}
    assert body["availability"] == [{"start": "2026-09-22", "end": "2026-10-20"}]
    assert body["confirmed"] is True
    assert body["demoData"] is True
    # profile_input shares email and LinkedIn but not the phone: absent keys, never nulls.
    assert body["contact"] == {
        "email": "jane@example.com",
        "linkedin": "linkedin.com/in/jane-mwangi",
    }
    # python is proven by the credential and the project; ui-ux by the project; backend stays
    # self-described, display only.
    assert [(s["id"], s["status"], s["evidence"]) for s in body["skills"]] == [
        ("python", "verified", "both"),
        ("ui-ux", "verified", "project"),
        ("backend", "self-described", None),
    ]
    assert [(p["id"], p["title"], p["licensable"], p["status"]) for p in body["projects"]] == [
        (ids["project"], "Clinic triage intake flow", True, "confirmed")
    ]


async def test_contact_block_follows_every_toggle(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    founder = await _role(db_session, bearer, "user_f", "founder")
    admin = await _role(db_session, bearer, "user_admin", "admin")
    account_id, _ = await _builder(
        api,
        db_session,
        bearer,
        sharing={"email": False, "phone": True, "linkedin": False},
    )
    await api.post(f"/api/admin/confirm/account/{account_id}", headers=admin)

    response = await api.get("/api/builders/jane-mwangi", headers=founder)

    assert response.json()["contact"] == {"phone": "+254700000000"}


async def test_pending_projects_are_not_shown_to_founders(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    founder = await _role(db_session, bearer, "user_f", "founder")
    admin = await _role(db_session, bearer, "user_admin", "admin")
    account_id, _ = await _builder(api, db_session, bearer)
    await api.post(f"/api/admin/confirm/account/{account_id}", headers=admin)

    response = await api.get("/api/builders/jane-mwangi", headers=founder)

    assert response.json()["projects"] == []
    assert all(s["status"] == "self-described" for s in response.json()["skills"])


async def test_admin_may_view_and_builder_may_not(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    admin = await _role(db_session, bearer, "user_admin", "admin")
    account_id, _ = await _builder(api, db_session, bearer)
    await api.post(f"/api/admin/confirm/account/{account_id}", headers=admin)

    as_admin = await api.get("/api/builders/jane-mwangi", headers=admin)
    as_builder = await api.get(
        "/api/builders/jane-mwangi", headers=bearer(sub="user_b", role="builder")
    )

    assert as_admin.status_code == 200
    assert as_builder.status_code == 403


async def test_unknown_and_seed_builders_are_404(
    api: AsyncClient, bearer: Bearer, db_session: AsyncSession
) -> None:
    founder = await _role(db_session, bearer, "user_f", "founder")

    unknown = await api.get("/api/builders/nobody-here", headers=founder)
    seed = await api.get("/api/builders/amina-otieno", headers=founder)

    assert unknown.status_code == 404
    assert seed.status_code == 404
