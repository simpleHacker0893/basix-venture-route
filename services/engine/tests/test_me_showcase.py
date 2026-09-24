"""Seam: HTTP builder writes for Sprint 005a (spec #86, #94) with a fake Clerk JWT (D-19):
`PUT /api/me/projects/{id}/showcase`, `POST /api/me/credentials` (certification fields, no skill),
`PUT /api/me/profile` (skill set, suggested skills, GitHub/LinkedIn links).

Acceptance §Part A Must 2 (write half) and Must 6; spec #86 Testing 1.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import Credential, Profile, Project
from tests.conftest import Actor, builder_profile_input

pytestmark = pytest.mark.anyio

VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def showcase_edit(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "description": "A field survey app for smallholder farmers.",
        "liveUrl": "https://survey.example.com",
        "demoUrl": "https://demo.example.com/survey",
        "pitchVideoUrl": VIDEO,
        "pitchDeckUrl": "https://slides.example.com/deck",
        "showcased": True,
    }
    body.update(overrides)
    return body


def _url(builder: Actor) -> str:
    return f"/api/me/projects/{builder.ids['project']}/showcase"


async def _project(session: AsyncSession, builder: Actor) -> Project:
    row = await session.get(Project, UUID(builder.ids["project"]))
    assert row is not None
    await session.refresh(row)
    return row


async def _mark_confirmed(session: AsyncSession, builder: Actor) -> datetime:
    """What an admin's showcase confirmation leaves behind (#103 owns the endpoint)."""
    row = await _project(session, builder)
    at = datetime(2026, 9, 20, 9, 0, tzinfo=UTC)
    row.showcase_status = "confirmed"
    row.showcase_confirmed_at = at
    session.add(row)
    await session.commit()
    return at


# -- PUT /api/me/projects/{id}/showcase ----------------------------------------------------------


async def test_saving_showcase_details_on_a_confirmed_project_is_pending(
    api: AsyncClient, confirmed_builder: Actor, db_session: AsyncSession
) -> None:
    response = await api.put(
        _url(confirmed_builder), json=showcase_edit(), headers=confirmed_builder.headers
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == confirmed_builder.ids["project"]
    assert {
        k: body[k]
        for k in (
            "description",
            "liveUrl",
            "demoUrl",
            "pitchVideoUrl",
            "pitchDeckUrl",
            "showcased",
            "showcaseStatus",
            "status",
            "skillIds",
        )
    } == {
        "description": "A field survey app for smallholder farmers.",
        "liveUrl": "https://survey.example.com",
        "demoUrl": "https://demo.example.com/survey",
        "pitchVideoUrl": VIDEO,
        "pitchDeckUrl": "https://slides.example.com/deck",
        "showcased": True,
        "showcaseStatus": "pending",
        "status": "confirmed",
        "skillIds": ["mobile"],
    }
    row = await _project(db_session, confirmed_builder)
    assert (row.showcased, row.showcase_status, row.showcase_confirmed_at) == (
        True,
        "pending",
        None,
    )


async def test_an_edit_sends_a_confirmed_entry_back_to_pending(
    api: AsyncClient, confirmed_builder: Actor, db_session: AsyncSession
) -> None:
    headers = confirmed_builder.headers
    assert (
        await api.put(_url(confirmed_builder), json=showcase_edit(), headers=headers)
    ).status_code == 200
    await _mark_confirmed(db_session, confirmed_builder)

    edited = await api.put(
        _url(confirmed_builder),
        json=showcase_edit(description="Now with offline sync."),
        headers=headers,
    )

    assert edited.status_code == 200
    assert edited.json()["showcaseStatus"] == "pending"
    row = await _project(db_session, confirmed_builder)
    assert (row.description, row.showcase_status, row.showcase_confirmed_at) == (
        "Now with offline sync.",
        "pending",
        None,
    )


async def test_identical_values_change_nothing(
    api: AsyncClient, confirmed_builder: Actor, db_session: AsyncSession
) -> None:
    headers = confirmed_builder.headers
    assert (
        await api.put(_url(confirmed_builder), json=showcase_edit(), headers=headers)
    ).status_code == 200
    confirmed_at = await _mark_confirmed(db_session, confirmed_builder)

    again = await api.put(_url(confirmed_builder), json=showcase_edit(), headers=headers)

    assert again.status_code == 200
    assert again.json()["showcaseStatus"] == "confirmed"
    row = await _project(db_session, confirmed_builder)
    assert (row.showcase_status, row.showcase_confirmed_at) == ("confirmed", confirmed_at)


async def test_unshowcasing_sets_none_and_clears_the_confirmation(
    api: AsyncClient, confirmed_builder: Actor, db_session: AsyncSession
) -> None:
    headers = confirmed_builder.headers
    assert (
        await api.put(_url(confirmed_builder), json=showcase_edit(), headers=headers)
    ).status_code == 200
    await _mark_confirmed(db_session, confirmed_builder)

    hidden = await api.put(
        _url(confirmed_builder), json=showcase_edit(showcased=False), headers=headers
    )

    assert hidden.status_code == 200
    assert (hidden.json()["showcased"], hidden.json()["showcaseStatus"]) == (False, "none")
    row = await _project(db_session, confirmed_builder)
    assert (row.showcased, row.showcase_status, row.showcase_confirmed_at) == (False, "none", None)


async def test_blank_links_are_stored_as_null(api: AsyncClient, confirmed_builder: Actor) -> None:
    response = await api.put(
        _url(confirmed_builder),
        json=showcase_edit(liveUrl="", demoUrl="  ", pitchVideoUrl=None, pitchDeckUrl=None),
        headers=confirmed_builder.headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert [body[k] for k in ("liveUrl", "demoUrl", "pitchVideoUrl", "pitchDeckUrl")] == [None] * 4


async def test_links_are_trimmed_before_saving(api: AsyncClient, confirmed_builder: Actor) -> None:
    response = await api.put(
        _url(confirmed_builder),
        json=showcase_edit(liveUrl="  https://survey.example.com  "),
        headers=confirmed_builder.headers,
    )

    assert response.status_code == 200
    assert response.json()["liveUrl"] == "https://survey.example.com"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"liveUrl": "http://survey.example.com"}, "liveUrl"),
        ({"demoUrl": "https://localhost/demo"}, "demoUrl"),
        ({"pitchDeckUrl": "https://127.0.0.1/deck"}, "pitchDeckUrl"),
        ({"pitchVideoUrl": "https://vimeo.com/123456"}, "pitchVideoUrl"),
        ({"description": "x" * 1001}, "description"),
    ],
)
async def test_invalid_showcase_input_is_422_naming_the_field(
    api: AsyncClient,
    confirmed_builder: Actor,
    db_session: AsyncSession,
    override: dict[str, Any],
    field: str,
) -> None:
    response = await api.put(
        _url(confirmed_builder), json=showcase_edit(**override), headers=confirmed_builder.headers
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert response.json()["message"].startswith(f"{field}:")
    row = await _project(db_session, confirmed_builder)
    assert (row.showcased, row.showcase_status) == (False, "none")


async def test_another_builders_project_is_404(
    api: AsyncClient, confirmed_builder: Actor, pending_builder: Actor, db_session: AsyncSession
) -> None:
    response = await api.put(
        _url(confirmed_builder), json=showcase_edit(), headers=pending_builder.headers
    )

    assert response.status_code == 404
    row = await _project(db_session, confirmed_builder)
    assert (row.showcased, row.showcase_status, row.description) == (False, "none", "")


@pytest.mark.parametrize("project_id", [str(uuid4()), "not-a-uuid"])
async def test_an_unknown_project_is_404(
    api: AsyncClient, confirmed_builder: Actor, project_id: str
) -> None:
    response = await api.put(
        f"/api/me/projects/{project_id}/showcase",
        json=showcase_edit(),
        headers=confirmed_builder.headers,
    )

    assert response.status_code == 404


async def test_showcase_edit_needs_a_builder_token(
    api: AsyncClient, confirmed_builder: Actor, founder: Actor, admin: Actor
) -> None:
    anonymous = await api.put(_url(confirmed_builder), json=showcase_edit())
    as_founder = await api.put(
        _url(confirmed_builder), json=showcase_edit(), headers=founder.headers
    )
    as_admin = await api.put(_url(confirmed_builder), json=showcase_edit(), headers=admin.headers)

    assert anonymous.status_code == 401
    assert (as_founder.status_code, as_admin.status_code) == (403, 403)


# -- POST /api/me/credentials: certification fields and skill-less certifications ---------------


async def test_a_skill_less_certification_is_accepted_with_its_fields(
    api: AsyncClient, unconfirmed_builder: Actor, db_session: AsyncSession
) -> None:
    body = {
        "title": "AWS Cloud Practitioner",
        "issuer": "Amazon Web Services",
        "issuedOn": "2026-05-14",
        "credentialUrl": " https://www.credly.com/badges/abc123 ",
    }

    created = await api.post("/api/me/credentials", json=body, headers=unconfirmed_builder.headers)
    listed = await api.get("/api/me/credentials", headers=unconfirmed_builder.headers)

    assert created.status_code == 201, created.text
    out = created.json()
    assert {
        k: out[k] for k in ("title", "issuer", "skillId", "issuedOn", "credentialUrl", "status")
    } == {
        "title": "AWS Cloud Practitioner",
        "issuer": "Amazon Web Services",
        "skillId": None,
        "issuedOn": "2026-05-14",
        "credentialUrl": "https://www.credly.com/badges/abc123",
        "status": "pending",
    }
    assert out in listed.json()
    row = await db_session.get(Credential, UUID(out["id"]))
    assert row is not None
    assert (row.skill_id, str(row.issued_on), row.credential_url) == (
        None,
        "2026-05-14",
        "https://www.credly.com/badges/abc123",
    )


async def test_a_vocabulary_credential_keeps_its_fields(
    api: AsyncClient, unconfirmed_builder: Actor
) -> None:
    body = {
        "title": "Python 201",
        "issuer": "MeTTa OmniUniversity",
        "skillId": "python",
        "issuedOn": "2026-06-01",
    }

    created = await api.post("/api/me/credentials", json=body, headers=unconfirmed_builder.headers)

    assert created.status_code == 201
    assert {k: created.json()[k] for k in ("skillId", "issuedOn", "credentialUrl")} == {
        "skillId": "python",
        "issuedOn": "2026-06-01",
        "credentialUrl": None,
    }


async def test_a_bad_credential_url_is_422_naming_the_field(
    api: AsyncClient, unconfirmed_builder: Actor
) -> None:
    body = {"title": "Cert", "issuer": "Issuer", "credentialUrl": "http://example.com/cert"}

    response = await api.post("/api/me/credentials", json=body, headers=unconfirmed_builder.headers)

    assert response.status_code == 422
    assert response.json()["message"].startswith("credentialUrl:")


# -- PUT /api/me/profile: skill set, suggested skills, profile links -----------------------------


def _profile(**overrides: Any) -> dict[str, Any]:
    body = builder_profile_input("Naomi Chebet")
    body.update(overrides)
    return body


async def test_profile_saves_skill_set_suggestions_and_links(
    api: AsyncClient, unconfirmed_builder: Actor, db_session: AsyncSession
) -> None:
    body = _profile(
        skillSet=[" Kotlin ", "Figma"],
        suggestedSkills=["GraphQL"],
        githubUrl="https://github.com/naomi",
        linkedinUrl="https://www.linkedin.com/in/naomi-chebet",
    )

    saved = await api.put("/api/me/profile", json=body, headers=unconfirmed_builder.headers)
    fetched = await api.get("/api/me/profile", headers=unconfirmed_builder.headers)

    assert saved.status_code == 200, saved.text
    for response in (saved, fetched):
        out = response.json()
        assert {
            k: out[k]
            for k in (
                "skillSet",
                "suggestedSkills",
                "githubUrl",
                "linkedinUrl",
                "selfDescribedSkills",
            )
        } == {
            "skillSet": ["Kotlin", "Figma"],
            "suggestedSkills": ["GraphQL"],
            "githubUrl": "https://github.com/naomi",
            "linkedinUrl": "https://www.linkedin.com/in/naomi-chebet",
            "selfDescribedSkills": ["mobile"],
        }
    row = await db_session.get(Profile, (await _profile_id(db_session, unconfirmed_builder)))
    assert row is not None
    await db_session.refresh(row)
    assert (row.skill_set, row.suggested_skills, row.linkedin) == (
        ["Kotlin", "Figma"],
        ["GraphQL"],
        None,
    )


async def _profile_id(session: AsyncSession, builder: Actor) -> UUID:
    from app.marketplace import repo

    profile = await repo.profile_for_user(session, builder.user_id)
    assert profile is not None
    return profile.id


async def test_blank_profile_links_are_stored_as_null(
    api: AsyncClient, unconfirmed_builder: Actor
) -> None:
    saved = await api.put(
        "/api/me/profile",
        json=_profile(githubUrl="", linkedinUrl="  "),
        headers=unconfirmed_builder.headers,
    )

    assert saved.status_code == 200
    assert (saved.json()["githubUrl"], saved.json()["linkedinUrl"]) == (None, None)


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"skillSet": [f"skill {n}" for n in range(21)]}, "skillSet"),
        (
            {
                "skillSet": [f"skill {n}" for n in range(15)],
                "suggestedSkills": [f"x{n}" for n in range(6)],
            },
            "suggestedSkills",
        ),
        ({"skillSet": ["Kotlin", "kotlin"]}, "skillSet"),
        ({"skillSet": ["Kotlin"], "suggestedSkills": ["KOTLIN"]}, "suggestedSkills"),
        ({"skillSet": ["x" * 41]}, "skillSet"),
        ({"githubUrl": "https://gitlab.com/naomi"}, "githubUrl"),
        ({"githubUrl": "http://github.com/naomi"}, "githubUrl"),
        ({"linkedinUrl": "https://linkedin.example.com/in/naomi"}, "linkedinUrl"),
        ({"linkedinUrl": "https://github.com/naomi"}, "linkedinUrl"),
    ],
)
async def test_invalid_skill_set_or_links_are_422_naming_the_field(
    api: AsyncClient, unconfirmed_builder: Actor, override: dict[str, Any], field: str
) -> None:
    response = await api.put(
        "/api/me/profile", json=_profile(**override), headers=unconfirmed_builder.headers
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert response.json()["message"].startswith(f"{field}")
