"""Seam: HTTP `GET /api/requests/{id}/eligibility` and the `eligibility` field on the builder's
`GET /api/requests` (Sprint 004, #61; D-19 seam one, spec #52 §HTTP API).

The verdict is the route service's `eligibility(brief, builder_id)` with the builder's profile
slug as the id (#56); the engine call runs under the engine lock in a worker thread, like
routing. Expected values come from the seed and the shared cast: the confirmed Naomi Chebet is
verified for `mobile` and available 2026-09-22 to 2026-10-20, the Constrained brief needs
mobile + rust remote in 2026-09-22 to 2026-10-06.
"""

from collections.abc import Callable

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.conftest import Actor
from tests.test_requests import publish, seed_brief

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


async def test_confirmed_builder_is_eligible_with_the_eligible_builder_path(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)

    response = await api.get(
        f"/api/requests/{request['id']}/eligibility", headers=confirmed_builder.headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["eligible"] is True
    assert body["skills"] == ["mobile"]
    assert body["reason"] is None
    assert body["path"]["rule"] == "eligible-builder"
    assert "(confirmed admin-basix naomi-chebet)" in body["path"]["facts"]
    assert body["path"]["conclusion"] == "naomi-chebet is eligible for mobile with both evidence"


async def test_unconfirmed_builder_gets_the_template_reason(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor, pending_builder: Actor
) -> None:
    """With Naomi confirmed the Constrained route has no gap, so Ali Hassan, who has a profile
    but no atoms, reads the template."""
    request = await publish(api, founder)

    response = await api.get(
        f"/api/requests/{request['id']}/eligibility", headers=pending_builder.headers
    )

    assert response.status_code == 200
    assert response.json() == {
        "eligible": False,
        "skills": [],
        "path": None,
        "reason": "eligible-builder does not hold for ali-hassan on any of mobile, rust.",
    }


async def test_verified_but_unavailable_builder_reads_the_route_gap_statement(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    brief = {
        **await seed_brief(api),
        "availabilityStart": "2026-11-02",
        "availabilityEnd": "2026-11-09",
    }
    route = (await api.post("/api/route", json=brief)).json()
    assert route["gaps"][0]["category"] == "availability"
    request = await publish(
        api, founder, availabilityStart="2026-11-02", availabilityEnd="2026-11-09"
    )

    response = await api.get(
        f"/api/requests/{request['id']}/eligibility", headers=confirmed_builder.headers
    )

    assert response.status_code == 200
    assert response.json()["eligible"] is False
    assert response.json()["reason"] == route["gaps"][0]["statement"]


async def test_builder_without_a_profile_is_404_and_a_founder_is_403(
    api: AsyncClient, founder: Actor, bearer: Bearer, db_session: AsyncSession
) -> None:
    db_session.add(User(clerk_id="user_noprofile", email="np@example.com", role="builder"))
    await db_session.commit()
    no_profile = bearer(sub="user_noprofile", role="builder")
    request = await publish(api, founder)

    as_builder = await api.get(f"/api/requests/{request['id']}/eligibility", headers=no_profile)
    as_list = await api.get("/api/requests", headers=no_profile)
    as_founder = await api.get(
        f"/api/requests/{request['id']}/eligibility", headers=founder.headers
    )
    unknown = await api.get(
        "/api/requests/00000000-0000-0000-0000-000000000000/eligibility",
        headers=no_profile,
    )

    assert as_builder.status_code == 404
    assert as_builder.json()["detail"] == "no profile yet"
    assert as_list.status_code == 404
    assert as_founder.status_code == 403
    assert unknown.status_code == 404


async def test_the_builders_list_carries_eligibility_and_the_founders_does_not(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    constrained = await publish(api, founder)
    health = await publish(api, founder, brief_id="brief-health-01")

    builder_list = (await api.get("/api/requests", headers=confirmed_builder.headers)).json()
    founder_list = (await api.get("/api/requests", headers=founder.headers)).json()

    by_id = {item["id"]: item["eligibility"] for item in builder_list}
    assert by_id[constrained["id"]]["eligible"] is True
    assert by_id[constrained["id"]]["skills"] == ["mobile"]
    assert by_id[health["id"]]["eligible"] is False
    assert by_id[health["id"]]["reason"] == (
        "eligible-builder does not hold for naomi-chebet on any of python, ai-metta, ui-ux."
    )
    assert [item["eligibility"] for item in founder_list] == [None, None]
    single = (
        await api.get(
            f"/api/requests/{constrained['id']}/eligibility", headers=confirmed_builder.headers
        )
    ).json()
    assert by_id[constrained["id"]] == single
