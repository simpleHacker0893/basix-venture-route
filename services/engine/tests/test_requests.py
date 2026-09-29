"""Seam: HTTP /api/requests with fake JWTs per role and per-test rollback (Sprint 004, #59;
D-19 seam one, spec #52 §HTTP API).

A founder publishes the brief and route they just saw; both sides read it back. Tests use the
seed Constrained brief because the confirmed cast builder is eligible for it (the Health brief
of Must 1 has the same shape).
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.conftest import Actor, Decide, _user, builder_profile_input

pytestmark = pytest.mark.anyio

CONSTRAINED = "brief-constrained-01"


async def seed_brief(api: AsyncClient, brief_id: str = CONSTRAINED) -> dict[str, Any]:
    briefs = (await api.get("/api/scenarios")).json()
    brief: dict[str, Any] = next(b for b in briefs if b["id"] == brief_id)
    return brief


async def route_snapshot(api: AsyncClient, brief: dict[str, Any]) -> dict[str, Any]:
    route = (await api.post("/api/route", json=brief)).json()
    return {
        "status": route["status"],
        "totalDailyRate": route["totalDailyRate"],
        "builderIds": [b["builderId"] for b in route["builders"]],
    }


async def publish(
    api: AsyncClient, founder: Actor, brief_id: str = CONSTRAINED, **brief_overrides: Any
) -> dict[str, Any]:
    brief = {**await seed_brief(api, brief_id), **brief_overrides}
    response = await api.post(
        "/api/requests",
        json={"brief": brief, "route": await route_snapshot(api, brief)},
        headers=founder.headers,
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# -- publish and read back ------------------------------------------------------------------------


async def test_founder_publishes_the_constrained_brief_and_reads_it_back(
    api: AsyncClient, founder: Actor
) -> None:
    brief = await seed_brief(api)
    snapshot = await route_snapshot(api, brief)
    assert snapshot == {
        "status": "partial",
        "totalDailyRate": 130,
        "builderIds": ["zawadi-njoroge"],
    }

    created = await api.post(
        "/api/requests", json={"brief": brief, "route": snapshot}, headers=founder.headers
    )

    assert created.status_code == 201
    body = created.json()
    assert body["brief"] == brief
    assert body["route"] == snapshot
    assert body["founderId"] == "user_founder"
    assert (body["status"], body["closedAt"], body["routeStatus"]) == ("open", None, "partial")
    assert (body["title"], body["vertical"], body["deliveryMode"]) == (
        brief["title"],
        "agri",
        "remote",
    )
    assert (body["availabilityStart"], body["availabilityEnd"], body["dailyBudget"]) == (
        "2026-09-22",
        "2026-10-06",
        300,
    )
    assert body["eligibility"] is None
    assert body["demoData"] is True
    assert body["createdAt"].endswith("Z") or "+" in body["createdAt"]

    read = await api.get(f"/api/requests/{body['id']}", headers=founder.headers)
    listed = await api.get("/api/requests", headers=founder.headers)

    assert read.status_code == 200
    assert read.json() == body
    assert listed.status_code == 200
    assert listed.json() == [body]


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"requiredSkills": ["mobile", "mobile"]}, "requiredSkills"),
        ({"availabilityStart": "2026-10-06", "availabilityEnd": "2026-09-22"}, "availabilityEnd"),
        ({"deliveryMode": "on-site", "location": None}, "location"),
        ({"dailyBudget": 0}, "dailyBudget"),
    ],
)
async def test_malformed_brief_is_422_with_the_field_named(
    api: AsyncClient, founder: Actor, override: dict[str, Any], fragment: str
) -> None:
    brief = {**await seed_brief(api), **override}

    response = await api.post(
        "/api/requests",
        json={
            "brief": brief,
            "route": {"status": "partial", "totalDailyRate": 0, "builderIds": []},
        },
        headers=founder.headers,
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert fragment in response.json()["message"]


async def test_route_snapshot_is_validated_but_never_recomputed(
    api: AsyncClient, founder: Actor
) -> None:
    """The client posts what it holds; the engine stores the snapshot as display-only."""
    brief = await seed_brief(api)

    bad = await api.post(
        "/api/requests",
        json={"brief": brief, "route": {"status": "great", "totalDailyRate": 1, "builderIds": []}},
        headers=founder.headers,
    )
    stored = await api.post(
        "/api/requests",
        json={
            "brief": brief,
            "route": {"status": "feasible", "totalDailyRate": 1, "builderIds": []},
        },
        headers=founder.headers,
    )

    assert bad.status_code == 422
    assert stored.status_code == 201
    assert stored.json()["routeStatus"] == "feasible"


# -- who sees what ---------------------------------------------------------------------------------


async def test_founders_see_their_own_requests_and_builders_see_every_open_one(
    api: AsyncClient, founder: Actor, other_founder: Actor, unconfirmed_builder: Actor
) -> None:
    mine = await publish(api, founder)
    theirs = await publish(api, other_founder, brief_id="brief-agri-01")

    founder_list = await api.get("/api/requests", headers=founder.headers)
    other_list = await api.get("/api/requests", headers=other_founder.headers)
    builder_list = await api.get("/api/requests", headers=unconfirmed_builder.headers)

    assert [r["id"] for r in founder_list.json()] == [mine["id"]]
    assert [r["id"] for r in other_list.json()] == [theirs["id"]]
    assert [r["id"] for r in builder_list.json()] == [theirs["id"], mine["id"]], "newest first"


async def test_another_founder_reads_404_and_a_builder_reads_200(
    api: AsyncClient, founder: Actor, other_founder: Actor, unconfirmed_builder: Actor
) -> None:
    mine = await publish(api, founder)

    other = await api.get(f"/api/requests/{mine['id']}", headers=other_founder.headers)
    builder = await api.get(f"/api/requests/{mine['id']}", headers=unconfirmed_builder.headers)
    unknown = await api.get(
        "/api/requests/00000000-0000-0000-0000-000000000000", headers=founder.headers
    )

    assert other.status_code == 404
    assert other.json()["detail"] == f"no request {mine['id']}"
    assert builder.status_code == 200
    assert builder.json()["id"] == mine["id"]
    assert unknown.status_code == 404


async def test_builders_and_admins_cannot_publish(
    api: AsyncClient, unconfirmed_builder: Actor, admin: Actor
) -> None:
    brief = await seed_brief(api)
    payload = {
        "brief": brief,
        "route": {"status": "partial", "totalDailyRate": 0, "builderIds": []},
    }

    builder = await api.post("/api/requests", json=payload, headers=unconfirmed_builder.headers)
    as_admin = await api.post("/api/requests", json=payload, headers=admin.headers)
    admin_list = await api.get("/api/requests", headers=admin.headers)

    assert builder.status_code == 403
    assert builder.json()["detail"] == "role founder required"
    assert as_admin.status_code == 403
    assert admin_list.status_code == 403


async def test_unauthenticated_calls_are_401(api: AsyncClient, founder: Actor) -> None:
    mine = await publish(api, founder)

    assert (await api.post("/api/requests", json={})).status_code == 401
    assert (await api.get("/api/requests")).status_code == 401
    assert (await api.get(f"/api/requests/{mine['id']}")).status_code == 401
    assert (await api.post(f"/api/requests/{mine['id']}/close")).status_code == 401


# -- close (#60): no further bids, gone from the builders' board -----------------------------------


async def test_close_answers_200_then_409_and_leaves_the_builders_board(
    api: AsyncClient, founder: Actor, unconfirmed_builder: Actor
) -> None:
    mine = await publish(api, founder)
    still_open = await publish(api, founder, brief_id="brief-agri-01")

    closed = await api.post(f"/api/requests/{mine['id']}/close", headers=founder.headers)
    again = await api.post(f"/api/requests/{mine['id']}/close", headers=founder.headers)

    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["closedAt"] is not None
    assert closed.json()["id"] == mine["id"]
    assert again.status_code == 409
    assert again.json()["detail"] == "request already closed"

    founder_list = (await api.get("/api/requests", headers=founder.headers)).json()
    builder_list = (await api.get("/api/requests", headers=unconfirmed_builder.headers)).json()
    read = await api.get(f"/api/requests/{mine['id']}", headers=founder.headers)

    assert [(r["id"], r["status"]) for r in founder_list] == [
        (still_open["id"], "open"),
        (mine["id"], "closed"),
    ]
    assert [r["id"] for r in builder_list] == [still_open["id"]]
    assert read.json()["status"] == "closed"
    assert read.json()["closedAt"] == closed.json()["closedAt"]


async def test_only_the_owning_founder_may_close(
    api: AsyncClient, founder: Actor, other_founder: Actor, unconfirmed_builder: Actor
) -> None:
    mine = await publish(api, founder)

    other = await api.post(f"/api/requests/{mine['id']}/close", headers=other_founder.headers)
    builder = await api.post(
        f"/api/requests/{mine['id']}/close", headers=unconfirmed_builder.headers
    )
    unknown = await api.post(
        "/api/requests/00000000-0000-0000-0000-000000000000/close", headers=founder.headers
    )

    assert other.status_code == 404
    assert builder.status_code == 403
    assert builder.json()["detail"] == "role founder required"
    assert unknown.status_code == 404
    assert (await api.get(f"/api/requests/{mine['id']}", headers=founder.headers)).json()[
        "status"
    ] == "open"


# -- Sprint 004 acceptance Must 1: the Health brief (#82) --------------------------------------------

HEALTH = "brief-health-01"


async def test_health_brief_publishes_and_a_python_verified_builder_reads_it_as_eligible(
    api: AsyncClient,
    founder: Actor,
    db_session: AsyncSession,
    bearer: Callable[..., dict[str, str]],
    decide: Decide,
) -> None:
    """Must 1: the founder publishes from the Health brief; a builder whose `python` credential
    the admin confirmed reads it with the engine's verdict (`python` only, no reason)."""
    user = await _user(db_session, bearer, "user_python", "builder")
    profile = await api.put(
        "/api/me/profile", json=builder_profile_input("Python Builder"), headers=user.headers
    )
    credential = await api.post(
        "/api/me/credentials",
        json={"title": "Python 201", "issuer": "MeTTa OmniUniversity", "skillId": "python"},
        headers=user.headers,
    )
    assert (profile.status_code, credential.status_code) == (200, 201)
    builder = Actor(
        clerk_id=user.clerk_id,
        role="builder",
        headers=user.headers,
        user_id=user.user_id,
        builder_id=profile.json()["builderId"],
        ids={"account": str(user.user_id), "credential": credential.json()["id"]},
    )
    await decide(builder, {"account": "confirmed", "credential": "confirmed"})

    created = await publish(api, founder, brief_id=HEALTH)
    listed = (await api.get("/api/requests", headers=builder.headers)).json()
    single = await api.get(f"/api/requests/{created['id']}/eligibility", headers=builder.headers)

    assert created["vertical"] == "health"
    assert created["brief"]["requiredSkills"] == ["python", "ai-metta", "ui-ux"]
    assert [item["id"] for item in listed] == [created["id"]]
    verdict = listed[0]["eligibility"]
    assert verdict["eligible"] is True
    assert verdict["skills"] == ["python"]
    assert verdict["reason"] is None
    assert verdict["path"]["rule"] == "eligible-builder"
    assert single.json() == verdict
