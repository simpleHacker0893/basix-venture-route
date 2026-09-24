"""Seam: HTTP public Showcase reads for Sprint 005a (spec #86, #101), no token (D-19):
`GET /api/showcase` (gallery list: filters, sort, paging) and `GET /api/showcase/{projectId}`.

Acceptance §Part A Must 2 (read half), Must 3 and Must 6; spec #86 Testing 2. Showcase
confirmations are set in the fixture (the admin endpoint is #103's).
"""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import Credential, Profile, Project, User
from tests.conftest import Actor, builder_profile_input

pytestmark = pytest.mark.anyio

VIDEO_ID = "dQw4w9WgXcQ"
VIDEO = f"https://www.youtube.com/watch?v={VIDEO_ID}"
NAOMI_PHONE = "+254700111222"
NAOMI_LINKEDIN_CONTACT = "linkedin.com/in/naomi-private-contact"
FORBIDDEN_KEYS = {"email", "phone", "location", "dayRate", "availability", "contact"}

AT_P1 = datetime(2026, 9, 20, 9, 0, tzinfo=UTC)
AT_LATER = datetime(2026, 9, 21, 9, 0, tzinfo=UTC)


def _edit(**overrides: Any) -> dict[str, Any]:
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


async def _publish(session: AsyncSession, project_id: str, at: datetime) -> None:
    """What a confirmed project plus an admin's showcase confirmation leave behind."""
    row = await session.get(Project, UUID(project_id))
    assert row is not None
    await session.refresh(row)
    row.status = "confirmed"
    row.showcase_status = "confirmed"
    row.showcase_confirmed_at = at
    session.add(row)
    await session.commit()


async def _showcase(
    api: AsyncClient,
    session: AsyncSession,
    builder: Actor,
    project_id: str,
    at: datetime | None,
    **edit: Any,
) -> None:
    response = await api.put(
        f"/api/me/projects/{project_id}/showcase", json=_edit(**edit), headers=builder.headers
    )
    assert response.status_code == 200, response.text
    if at is not None:
        await _publish(session, project_id, at)


async def _new_project(api: AsyncClient, builder: Actor, **fields: Any) -> str:
    response = await api.post("/api/me/projects", json=fields, headers=builder.headers)
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def _confirmed_credential(
    session: AsyncSession,
    builder: Actor,
    *,
    title: str,
    issuer: str,
    skill_id: str | None,
    status: str = "confirmed",
) -> None:
    profile = await _profile(session, builder)
    session.add(
        Credential(
            profile_id=profile.id,
            title=title,
            issuer=issuer,
            skill_id=skill_id,
            status=status,
            credential_url="https://verify.example.com/" + title.lower().replace(" ", "-"),
        )
    )
    await session.commit()


async def _profile(session: AsyncSession, builder: Actor) -> Profile:
    from sqlmodel import select

    row = (await session.exec(select(Profile).where(Profile.user_id == builder.user_id))).first()
    assert row is not None
    return row


async def _naomi_profile(api: AsyncClient, builder: Actor) -> None:
    """Contact details the public read must never carry, plus chips and public links."""
    body = builder_profile_input("Naomi Chebet") | {
        "phone": NAOMI_PHONE,
        "linkedin": NAOMI_LINKEDIN_CONTACT,
        "sharing": {"email": True, "phone": True, "linkedin": True},
        "skillSet": ["Flutter", "Mobile"],
        "suggestedSkills": ["Figma"],
        "githubUrl": "https://github.com/naomi-chebet",
    }
    response = await api.put("/api/me/profile", json=body, headers=builder.headers)
    assert response.status_code == 200, response.text


@pytest.fixture
async def gallery(
    api: AsyncClient,
    db_session: AsyncSession,
    confirmed_builder: Actor,
    rejected_builder: Actor,
) -> dict[str, str]:
    """Three public entries:

    - P1 Naomi "Field survey app", agri, licensable, demonstrates mobile, confirmed 09-20;
    - P2 Esther "Clinic 100% intake", health, demonstrates python, confirmed 09-21;
    - P3 Naomi "Classroom tutor", education, demonstrates ui-ux, confirmed 09-21 (ties P2).

    Naomi is verified for mobile (credential + P1) and python (credential); her chips are
    Flutter, Mobile (skillSet) and Figma (suggested). Esther is verified for mobile (credential).
    """
    await _naomi_profile(api, confirmed_builder)
    await _confirmed_credential(
        db_session, confirmed_builder, title="Python 201", issuer="MeTTa U", skill_id="python"
    )
    p1 = confirmed_builder.ids["project"]
    await _showcase(api, db_session, confirmed_builder, p1, AT_P1)
    p2 = await _new_project(
        api,
        rejected_builder,
        title="Clinic 100% intake",
        vertical="health",
        licensable=False,
        completedOn="2026-07-01",
        skillIds=["python"],
    )
    await _showcase(
        api, db_session, rejected_builder, p2, AT_LATER, pitchVideoUrl=None, description="Triage."
    )
    p3 = await _new_project(
        api,
        confirmed_builder,
        title="Classroom tutor",
        vertical="education",
        licensable=False,
        completedOn="2026-06-01",
        skillIds=["ui-ux"],
    )
    await _showcase(api, db_session, confirmed_builder, p3, AT_LATER, description="Tutor.")
    return {"p1": p1, "p2": p2, "p3": p3}


def _ids(body: dict[str, Any]) -> list[str]:
    return [item["id"] for item in body["items"]]


def _tie_order(a: str, b: str) -> list[str]:
    return sorted([a, b], key=UUID)


async def _list(api: AsyncClient, **params: Any) -> dict[str, Any]:
    response = await api.get("/api/showcase", params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


# -- no token ------------------------------------------------------------------------------------


async def test_both_reads_answer_200_without_a_token_and_ignore_a_bad_one(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    listed = await api.get("/api/showcase")
    detail = await api.get(f"/api/showcase/{gallery['p1']}")
    junk = {"Authorization": "Bearer not-a-jwt"}
    listed_junk = await api.get("/api/showcase", headers=junk)
    detail_junk = await api.get(f"/api/showcase/{gallery['p1']}", headers=junk)

    assert [r.status_code for r in (listed, detail, listed_junk, detail_junk)] == [200] * 4
    assert listed.json() == listed_junk.json()
    assert detail.json() == detail_junk.json()


# -- list: default order, card shape, paging -----------------------------------------------------


async def test_list_orders_by_confirmation_newest_first_then_id(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    body = await _list(api)

    assert body["total"] == 3
    assert _ids(body) == [*_tie_order(gallery["p2"], gallery["p3"]), gallery["p1"]]


async def test_a_card_carries_the_entry_the_builder_and_the_video_id(
    api: AsyncClient, gallery: dict[str, str], confirmed_builder: Actor
) -> None:
    body = await _list(api)
    card = next(item for item in body["items"] if item["id"] == gallery["p1"])

    assert card == {
        "id": gallery["p1"],
        "title": "Field survey app",
        "builderId": confirmed_builder.builder_id,
        "displayName": "Naomi Chebet",
        "cohortId": None,
        "vertical": "agri",
        "licensable": True,
        "description": "A field survey app for smallholder farmers.",
        "skillIds": ["mobile"],
        "matchedSkill": None,
        "liveUrl": "https://survey.example.com",
        "demoUrl": "https://demo.example.com/survey",
        "pitchVideoUrl": VIDEO,
        "pitchDeckUrl": "https://slides.example.com/deck",
        "pitchVideoId": VIDEO_ID,
        "demoData": card["demoData"],
    }
    p2 = next(item for item in body["items"] if item["id"] == gallery["p2"])
    assert (p2["pitchVideoUrl"], p2["pitchVideoId"]) == (None, None)


async def test_paging_limits_offsets_and_reports_the_total(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    everything = _ids(await _list(api))

    first = await _list(api, limit=1)
    second = await _list(api, limit=1, offset=1)
    tail = await _list(api, limit=2, offset=2)
    beyond = await _list(api, offset=10)

    assert (_ids(first), first["total"]) == (everything[:1], 3)
    assert (_ids(second), second["total"]) == (everything[1:2], 3)
    assert (_ids(tail), tail["total"]) == (everything[2:], 3)
    assert (_ids(beyond), beyond["total"]) == ([], 3)


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 25},
        {"limit": "many"},
        {"offset": -1},
        {"vertical": "space"},
        {"licensable": "perhaps"},
    ],
)
async def test_invalid_parameters_answer_422(
    api: AsyncClient, gallery: dict[str, str], params: dict[str, Any]
) -> None:
    response = await api.get("/api/showcase", params=params)

    assert response.status_code == 422, response.text


# -- list: filters -------------------------------------------------------------------------------


def _matched(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {item["id"]: item["matchedSkill"] for item in body["items"]}


async def test_skill_filter_reports_demonstrated_before_verified_before_self_described(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    # P1 demonstrates mobile (and Naomi's skillSet says "Mobile" too): demonstrated wins.
    # P3 is Naomi's: verified mobile beats her "Mobile" chip. P2: Esther's credential verifies it.
    body = await _list(api, skill="mobile")

    assert body["total"] == 3
    assert _matched(body) == {
        gallery["p1"]: {"id": "mobile", "label": "Mobile", "kind": "demonstrated"},
        gallery["p2"]: {"id": "mobile", "label": "Mobile", "kind": "verified"},
        gallery["p3"]: {"id": "mobile", "label": "Mobile", "kind": "verified"},
    }


async def test_skill_filter_matches_a_verified_skill_no_card_demonstrates(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    body = await _list(api, skill="python")

    assert _matched(body) == {
        gallery["p1"]: {"id": "python", "label": "Python", "kind": "verified"},
        gallery["p2"]: {"id": "python", "label": "Python", "kind": "demonstrated"},
        gallery["p3"]: {"id": "python", "label": "Python", "kind": "verified"},
    }


@pytest.mark.parametrize(("skill", "label"), [("flutter", "Flutter"), ("FIGMA", "Figma")])
async def test_skill_filter_matches_skill_set_and_suggested_labels_case_insensitively(
    api: AsyncClient, gallery: dict[str, str], skill: str, label: str
) -> None:
    body = await _list(api, skill=skill)

    assert body["total"] == 2
    assert _matched(body) == {
        gallery["p1"]: {"id": None, "label": label, "kind": "self-described"},
        gallery["p3"]: {"id": None, "label": label, "kind": "self-described"},
    }


async def test_skill_filter_without_a_match_is_empty(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    assert await _list(api, skill="cobol") == {"items": [], "total": 0}


async def test_an_unconfirmed_proof_row_does_not_verify(
    api: AsyncClient, gallery: dict[str, str], db_session: AsyncSession, rejected_builder: Actor
) -> None:
    await _confirmed_credential(
        db_session,
        rejected_builder,
        title="Rust 101",
        issuer="X",
        skill_id="rust",
        status="pending",
    )

    assert await _list(api, skill="rust") == {"items": [], "total": 0}


async def test_vertical_licensable_and_title_filters(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    assert _ids(await _list(api, vertical="health")) == [gallery["p2"]]
    assert _ids(await _list(api, licensable="true")) == [gallery["p1"]]
    assert _ids(await _list(api, licensable="false")) == _tie_order(gallery["p2"], gallery["p3"])
    assert _ids(await _list(api, q="SURVEY")) == [gallery["p1"]]
    assert _ids(await _list(api, q="class")) == [gallery["p3"]]
    # LIKE wildcards are literal: '%' and '_' only match titles that contain them.
    assert _ids(await _list(api, q="%")) == [gallery["p2"]]
    assert _ids(await _list(api, q="100%")) == [gallery["p2"]]
    assert await _list(api, q="_") == {"items": [], "total": 0}
    combined = await _list(api, skill="mobile", vertical="education", q="tutor")
    assert (_ids(combined), combined["total"]) == ([gallery["p3"]], 1)


# -- visibility: one rule, list and detail agree -------------------------------------------------


HIDERS: dict[str, Callable[[Project, User], None]] = {
    "project not confirmed": lambda p, u: setattr(p, "status", "pending"),
    "project rejected": lambda p, u: setattr(p, "status", "rejected"),
    "account unconfirmed": lambda p, u: setattr(u, "status", "pending"),
    "showcased false": lambda p, u: setattr(p, "showcased", False),
    "showcase pending": lambda p, u: setattr(p, "showcase_status", "pending"),
    "showcase rejected": lambda p, u: setattr(p, "showcase_status", "rejected"),
}


@pytest.mark.parametrize("case", list(HIDERS))
async def test_a_hidden_entry_is_absent_and_404_like_a_missing_one(
    api: AsyncClient,
    gallery: dict[str, str],
    db_session: AsyncSession,
    confirmed_builder: Actor,
    case: str,
) -> None:
    project = await db_session.get(Project, UUID(gallery["p1"]))
    user = await db_session.get(User, confirmed_builder.user_id)
    assert project is not None and user is not None
    HIDERS[case](project, user)
    db_session.add_all([project, user])
    await db_session.commit()

    body = await _list(api)
    hidden = await api.get(f"/api/showcase/{gallery['p1']}")
    missing = await api.get(f"/api/showcase/{uuid4()}")
    malformed = await api.get("/api/showcase/not-a-uuid")

    assert gallery["p1"] not in _ids(body)
    assert body["total"] == len(body["items"])
    assert (hidden.status_code, missing.status_code, malformed.status_code) == (404, 404, 404)
    assert hidden.json() == missing.json() == malformed.json()


async def test_absent_until_confirmed_present_after_and_an_edit_takes_it_off(
    api: AsyncClient, db_session: AsyncSession, confirmed_builder: Actor
) -> None:
    project_id = confirmed_builder.ids["project"]
    await _showcase(api, db_session, confirmed_builder, project_id, None)
    assert project_id not in _ids(await _list(api))
    assert (await api.get(f"/api/showcase/{project_id}")).status_code == 404

    await _publish(db_session, project_id, AT_P1)
    assert project_id in _ids(await _list(api))
    assert (await api.get(f"/api/showcase/{project_id}")).status_code == 200

    await _showcase(api, db_session, confirmed_builder, project_id, None, description="Edited.")
    assert project_id not in _ids(await _list(api))
    assert (await api.get(f"/api/showcase/{project_id}")).status_code == 404


# -- detail ----------------------------------------------------------------------------------------


async def test_detail_shows_the_project_and_the_builder_panel(
    api: AsyncClient, gallery: dict[str, str], db_session: AsyncSession, confirmed_builder: Actor
) -> None:
    await _confirmed_credential(
        db_session, confirmed_builder, title="Cloud Cert", issuer="AWS", skill_id=None
    )
    await _confirmed_credential(
        db_session,
        confirmed_builder,
        title="Pending Cert",
        issuer="Nobody",
        skill_id=None,
        status="pending",
    )
    await _confirmed_credential(
        db_session,
        confirmed_builder,
        title="Rejected Cert",
        issuer="Nobody",
        skill_id=None,
        status="rejected",
    )

    response = await api.get(f"/api/showcase/{gallery['p1']}")

    assert response.status_code == 200, response.text
    body = response.json()
    builder = body.pop("builder")
    assert body == {
        "id": gallery["p1"],
        "title": "Field survey app",
        "vertical": "agri",
        "licensable": True,
        "description": "A field survey app for smallholder farmers.",
        "completedOn": "2026-08-12",
        "skillIds": ["mobile"],
        "liveUrl": "https://survey.example.com",
        "demoUrl": "https://demo.example.com/survey",
        "pitchVideoUrl": VIDEO,
        "pitchDeckUrl": "https://slides.example.com/deck",
        "pitchVideoId": VIDEO_ID,
        "demoData": body["demoData"],
    }
    assert builder["builderId"] == confirmed_builder.builder_id
    assert builder["displayName"] == "Naomi Chebet"
    # The profile skill order (repo.skill_names); P3 demonstrates ui-ux, so it is verified too.
    assert [(s["id"], s["status"], s["evidence"]) for s in builder["verifiedSkills"]] == [
        ("mobile", "verified", "both"),
        ("python", "verified", "credential"),
        ("ui-ux", "verified", "project"),
    ]
    assert builder["skillSet"] == ["Flutter", "Mobile", "Figma"]
    assert sorted(c["title"] for c in builder["certifications"]) == [
        "Cloud Cert",
        "Mobile 301",
        "Python 201",
    ]
    assert all(c["status"] == "confirmed" for c in builder["certifications"])
    assert (builder["githubUrl"], builder["linkedinUrl"]) == (
        "https://github.com/naomi-chebet",
        None,
    )


# -- no contact details anywhere -------------------------------------------------------------------


def _walk(value: Any) -> tuple[set[str], list[str]]:
    keys: set[str] = set()
    strings: list[str] = []
    if isinstance(value, dict):
        for key, inner in value.items():
            keys.add(key)
            more_keys, more_strings = _walk(inner)
            keys |= more_keys
            strings += more_strings
    elif isinstance(value, list):
        for inner in value:
            more_keys, more_strings = _walk(inner)
            keys |= more_keys
            strings += more_strings
    elif isinstance(value, str | int):
        strings.append(str(value))
    return keys, strings


async def test_no_response_carries_contact_location_rate_or_availability(
    api: AsyncClient, gallery: dict[str, str]
) -> None:
    responses = [await api.get("/api/showcase"), await api.get("/api/showcase?skill=flutter")]
    responses += [await api.get(f"/api/showcase/{pid}") for pid in gallery.values()]
    assert all(r.status_code == 200 for r in responses)

    for response in responses:
        keys, strings = _walk(response.json())
        assert not keys & FORBIDDEN_KEYS, keys & FORBIDDEN_KEYS
        joined = "\n".join(strings)
        for secret in (
            "naomi@example.com",
            "esther@example.com",
            NAOMI_PHONE,
            NAOMI_LINKEDIN_CONTACT,
            "Nairobi",
            "2026-09-22",
            "2026-10-20",
        ):
            assert secret not in joined, secret
        # The day rate (120) never appears as a value either.
        assert "120" not in strings
