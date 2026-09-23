"""Seam: HTTP /api/requests with fake JWTs per role and per-test rollback (Sprint 004, #59;
D-19 seam one, spec #52 §HTTP API).

A founder publishes the brief and route they just saw; both sides read it back. Tests use the
seed Constrained brief because the confirmed cast builder is eligible for it (the Health brief
of Must 1 has the same shape).
"""

from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import Actor

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
