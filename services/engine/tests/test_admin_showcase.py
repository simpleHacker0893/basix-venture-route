"""Seam: HTTP /api/admin/* for the `showcase` kind with a fake admin JWT (D-19, spec #86, #103).

An admin moderates Showcase entries: the pending queue carries the card preview with the parsed
pitch video id and the two warning flags (story 49); confirm and reject each log a
`confirmations` row of kind `showcase`, set or clear `showcase_confirmed_at`, reproject once
(D-52) and answer `projectedRows`; the decided view lists showcase decisions and the #49 reverse
works on them. Visibility is observed through the public `GET /api/showcase` (acceptance §Part A
Must 2 end to end) and the `(showcases b p)` display fact in the engine's space.
"""

from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import short
from app.marketplace.models import Confirmation, Project
from tests.conftest import TEST_NOW, Actor

pytestmark = pytest.mark.anyio

VIDEO_ID = "dQw4w9WgXcQ"
WITHDRAWN = "Builder has withdrawn this entry"


def _entry(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "description": "A field survey app for smallholder farmers.",
        "liveUrl": "https://survey.example.com",
        "demoUrl": "https://demo.example.com/survey",
        "pitchVideoUrl": f"https://youtu.be/{VIDEO_ID}",
        "pitchDeckUrl": "https://slides.example.com/deck",
        "showcased": True,
    }
    body.update(overrides)
    return body


async def _submit(api: AsyncClient, builder: Actor, **overrides: Any) -> str:
    project_id = builder.ids["project"]
    response = await api.put(
        f"/api/me/projects/{project_id}/showcase", json=_entry(**overrides), headers=builder.headers
    )
    assert response.status_code == 200, response.text
    return project_id


async def _queue(api: AsyncClient, admin: Actor, which: str) -> dict[str, Any]:
    response = await api.get(f"/api/admin/{which}", headers=admin.headers)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def _gallery_ids(api: AsyncClient) -> list[str]:
    response = await api.get("/api/showcase")
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


async def _health_rows(api: AsyncClient) -> int:
    rows: int = (await api.get("/health")).json()["projected_rows"]
    return rows


def _showcases(engine: MettaRouteEngine) -> list[str]:
    facts: list[str] = []
    for term in engine._query("!(match &self (showcases $b $p) (showcases $b $p))"):
        assert isinstance(term, list)
        facts.append("(" + " ".join(str(part) for part in term) + ")")
    return sorted(facts)


async def _showcase_log(session: AsyncSession, project_id: str) -> list[str]:
    statement = (
        select(Confirmation)
        .where(Confirmation.kind == "showcase", Confirmation.target_id == UUID(project_id))
        .order_by(col(Confirmation.created_at))
    )
    return [row.decision for row in (await session.exec(statement)).all()]


async def _project(session: AsyncSession, project_id: str) -> Project:
    row = await session.get(Project, UUID(project_id))
    assert row is not None
    await session.refresh(row)
    return row


# -- the pending queue -----------------------------------------------------------------


async def test_pending_queue_previews_a_showcase_entry_with_both_warnings(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    project_id = await _submit(api, unconfirmed_builder)

    body = await _queue(api, admin, "pending")

    assert body["showcase"] == [
        {
            "id": project_id,
            "builderId": "naomi-chebet",
            "displayName": "Naomi Chebet",
            "cohortId": None,
            "title": "Field survey app",
            "description": "A field survey app for smallholder farmers.",
            "vertical": "agri",
            "licensable": True,
            "skillIds": ["mobile"],
            "liveUrl": "https://survey.example.com",
            "demoUrl": "https://demo.example.com/survey",
            "pitchVideoUrl": body["showcase"][0]["pitchVideoUrl"],
            "pitchDeckUrl": "https://slides.example.com/deck",
            "pitchVideoId": VIDEO_ID,
            "showcaseStatus": "pending",
            "projectStatus": "pending",
            "accountConfirmed": False,
            "submittedAt": body["showcase"][0]["submittedAt"],
            "demoData": True,
        }
    ]
    assert VIDEO_ID in body["showcase"][0]["pitchVideoUrl"]


async def test_pending_queue_clears_the_warnings_once_project_and_account_are_confirmed(
    api: AsyncClient, admin: Actor, confirmed_builder: Actor
) -> None:
    await _submit(api, confirmed_builder, pitchVideoUrl=None)

    [row] = (await _queue(api, admin, "pending"))["showcase"]

    assert (row["projectStatus"], row["accountConfirmed"]) == ("confirmed", True)
    assert (row["pitchVideoUrl"], row["pitchVideoId"]) == (None, None)


async def test_a_project_never_showcased_is_not_in_the_showcase_queue(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    body = await _queue(api, admin, "pending")

    assert body["showcase"] == []
    assert [p["id"] for p in body["projects"]] == [unconfirmed_builder.ids["project"]]


# -- confirm, reject, reverse -------------------------------------------------------------


async def test_confirm_publishes_the_entry_and_reject_takes_it_down(
    api: AsyncClient,
    admin: Actor,
    confirmed_builder: Actor,
    engine: MettaRouteEngine,
    db_session: AsyncSession,
) -> None:
    project_id = await _submit(api, confirmed_builder)
    fact = f"(showcases naomi-chebet proj-{short(project_id)})"
    assert project_id not in await _gallery_ids(api)
    before = await _health_rows(api)

    confirmed = await api.post(f"/api/admin/confirm/showcase/{project_id}", headers=admin.headers)

    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json() == {
        "id": project_id,
        "kind": "showcase",
        "status": "confirmed",
        "projectedRows": await _health_rows(api),
    }
    assert confirmed.json()["projectedRows"] == before + 1
    assert project_id in await _gallery_ids(api)
    assert _showcases(engine) == [fact]
    row = await _project(db_session, project_id)
    assert (row.showcase_status, row.showcase_confirmed_at) == ("confirmed", TEST_NOW)
    assert (await _queue(api, admin, "pending"))["showcase"] == []

    rejected = await api.post(f"/api/admin/reject/showcase/{project_id}", headers=admin.headers)

    assert rejected.status_code == 200, rejected.text
    assert rejected.json() == {
        "id": project_id,
        "kind": "showcase",
        "status": "rejected",
        "projectedRows": before,
    }
    assert project_id not in await _gallery_ids(api)
    assert _showcases(engine) == []
    row = await _project(db_session, project_id)
    assert (row.showcase_status, row.showcase_confirmed_at) == ("rejected", None)
    assert await _showcase_log(db_session, project_id) == ["confirmed", "rejected"]


async def test_reversing_a_showcase_decision_from_the_decided_view(
    api: AsyncClient,
    admin: Actor,
    confirmed_builder: Actor,
    engine: MettaRouteEngine,
    db_session: AsyncSession,
) -> None:
    project_id = await _submit(api, confirmed_builder)
    await api.post(f"/api/admin/reject/showcase/{project_id}", headers=admin.headers)

    decided = (await _queue(api, admin, "decided"))["showcase"]
    assert [(d["id"], d["status"], d["showcaseStatus"]) for d in decided] == [
        (project_id, "rejected", "rejected")
    ]
    assert decided[0]["pitchVideoId"] == VIDEO_ID
    assert decided[0]["decidedAt"] >= decided[0]["submittedAt"]

    reversed_ = await api.post(f"/api/admin/confirm/showcase/{project_id}", headers=admin.headers)

    assert reversed_.status_code == 200, reversed_.text
    assert reversed_.json()["projectedRows"] == await _health_rows(api)
    assert project_id in await _gallery_ids(api)
    assert _showcases(engine) == [f"(showcases naomi-chebet proj-{short(project_id)})"]
    decided = (await _queue(api, admin, "decided"))["showcase"]
    assert [(d["id"], d["status"]) for d in decided] == [(project_id, "confirmed")]
    assert await _showcase_log(db_session, project_id) == ["rejected", "confirmed"]


async def test_confirming_an_entry_whose_project_is_pending_keeps_it_private(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor, engine: MettaRouteEngine
) -> None:
    project_id = await _submit(api, unconfirmed_builder)

    response = await api.post(f"/api/admin/confirm/showcase/{project_id}", headers=admin.headers)

    assert response.status_code == 200, response.text
    assert project_id not in await _gallery_ids(api)
    assert _showcases(engine) == []


# -- refusals ------------------------------------------------------------------------------


@pytest.mark.parametrize("decision", ["confirm", "reject"])
async def test_a_project_never_showcased_is_409_withdrawn(
    api: AsyncClient,
    admin: Actor,
    unconfirmed_builder: Actor,
    db_session: AsyncSession,
    decision: str,
) -> None:
    project_id = unconfirmed_builder.ids["project"]

    response = await api.post(f"/api/admin/{decision}/showcase/{project_id}", headers=admin.headers)

    assert response.status_code == 409
    assert response.json() == {"detail": WITHDRAWN}
    assert await _showcase_log(db_session, project_id) == []


async def test_an_entry_withdrawn_after_confirmation_is_409(
    api: AsyncClient, admin: Actor, confirmed_builder: Actor, db_session: AsyncSession
) -> None:
    project_id = await _submit(api, confirmed_builder)
    await api.post(f"/api/admin/confirm/showcase/{project_id}", headers=admin.headers)
    await _submit(api, confirmed_builder, showcased=False)

    response = await api.post(f"/api/admin/reject/showcase/{project_id}", headers=admin.headers)

    assert response.status_code == 409
    assert response.json() == {"detail": WITHDRAWN}
    assert (await _project(db_session, project_id)).showcase_status == "none"
    assert (await _queue(api, admin, "decided"))["showcase"] == []


@pytest.mark.parametrize("decision", ["confirm", "reject"])
async def test_an_unknown_id_or_a_non_project_is_404(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor, decision: str
) -> None:
    for target in (str(uuid4()), unconfirmed_builder.ids["credential"]):
        response = await api.post(f"/api/admin/{decision}/showcase/{target}", headers=admin.headers)

        assert response.status_code == 404, target


@pytest.mark.parametrize("decision", ["confirm", "reject"])
async def test_showcase_decisions_are_admin_only(
    api: AsyncClient,
    founder: Actor,
    unconfirmed_builder: Actor,
    db_session: AsyncSession,
    decision: str,
) -> None:
    project_id = await _submit(api, unconfirmed_builder)
    url = f"/api/admin/{decision}/showcase/{project_id}"

    assert (await api.post(url, headers=founder.headers)).status_code == 403
    assert (await api.post(url, headers=unconfirmed_builder.headers)).status_code == 403
    assert (await api.post(url)).status_code == 401
    assert await _showcase_log(db_session, project_id) == []
    assert (await _project(db_session, project_id)).showcase_status == "pending"


# -- carried from #94's review: certification fields on credential rows ---------------------------


async def test_credential_rows_carry_issued_on_and_credential_url(
    api: AsyncClient, admin: Actor, unconfirmed_builder: Actor
) -> None:
    created = await api.post(
        "/api/me/credentials",
        json={
            "title": "Cloud Practitioner",
            "issuer": "AWS",
            "skillId": None,
            "issuedOn": "2026-05-04",
            "credentialUrl": "https://verify.example.com/cloud",
        },
        headers=unconfirmed_builder.headers,
    )
    assert created.status_code == 201, created.text
    credential_id = created.json()["id"]

    pending = {c["id"]: c for c in (await _queue(api, admin, "pending"))["credentials"]}
    assert (
        pending[credential_id]["skillId"],
        pending[credential_id]["issuedOn"],
        pending[credential_id]["credentialUrl"],
    ) == (None, "2026-05-04", "https://verify.example.com/cloud")

    await api.post(f"/api/admin/confirm/credential/{credential_id}", headers=admin.headers)

    decided = {c["id"]: c for c in (await _queue(api, admin, "decided"))["credentials"]}
    assert (decided[credential_id]["issuedOn"], decided[credential_id]["credentialUrl"]) == (
        "2026-05-04",
        "https://verify.example.com/cloud",
    )
