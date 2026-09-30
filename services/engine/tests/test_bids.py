"""Seam: HTTP `POST /api/requests/{id}/bids` with fake JWTs and per-test rollback (Sprint 004,
#62; D-19 seam one, spec #52 §HTTP API).

A builder bids on an open request only when the engine says they are eligible; the refusal
carries the engine's reason verbatim (DOMAIN.md §Marketplace rules: a bid is allowed only where
`eligible-builder` holds). Expected values come from the seed and the shared cast.
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.conftest import Actor
from tests.test_requests import publish

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


def bid_input(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "dayRate": 120,
        "message": "The field survey app demonstrates mobile.",
    }
    body.update(overrides)
    return body


async def bid(
    api: AsyncClient, builder: Actor, request_id: str, **overrides: Any
) -> dict[str, Any]:
    response = await api.post(
        f"/api/requests/{request_id}/bids", json=bid_input(**overrides), headers=builder.headers
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# -- the gate ------------------------------------------------------------------------------------


async def test_eligible_builders_bid_is_stored_with_the_engines_skills_and_path(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)

    response = await api.post(
        f"/api/requests/{request['id']}/bids", json=bid_input(), headers=confirmed_builder.headers
    )

    assert response.status_code == 201
    body = response.json()
    assert body["requestId"] == request["id"]
    assert (body["requestTitle"], body["requestStatus"]) == (request["title"], "open")
    assert (body["builderId"], body["displayName"]) == ("naomi-chebet", "Naomi Chebet")
    assert (body["dayRate"], body["message"]) == (120, "The field survey app demonstrates mobile.")
    assert body["eligibleSkills"] == ["mobile"]
    assert body["path"]["rule"] == "eligible-builder"
    assert "(confirmed admin-basix naomi-chebet)" in body["path"]["facts"]
    assert body["status"] == "submitted"
    assert body["demoData"] is True
    assert body["id"]
    assert body["createdAt"]


async def test_ineligible_builders_bid_is_403_with_the_eligibility_reason(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor, pending_builder: Actor
) -> None:
    request = await publish(api, founder)
    verdict = (
        await api.get(f"/api/requests/{request['id']}/eligibility", headers=pending_builder.headers)
    ).json()
    assert verdict["eligible"] is False

    response = await api.post(
        f"/api/requests/{request['id']}/bids", json=bid_input(), headers=pending_builder.headers
    )

    assert response.status_code == 403
    assert response.json()["detail"] == verdict["reason"]
    assert response.json()["detail"] == (
        "eligible-builder does not hold for ali-hassan on any of mobile, rust."
    )


async def test_a_verified_builder_is_refused_on_a_brief_they_do_not_cover(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    """Naomi is verified for mobile only; the Health brief needs python, ai-metta, ui-ux."""
    health = await publish(api, founder, brief_id="brief-health-01")

    response = await api.post(
        f"/api/requests/{health['id']}/bids", json=bid_input(), headers=confirmed_builder.headers
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "eligible-builder does not hold for naomi-chebet on any of python, ai-metta, ui-ux."
    )


# -- closed, duplicate, roles, validation --------------------------------------------------------


async def test_a_bid_on_a_closed_request_is_409(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)
    assert (
        await api.post(f"/api/requests/{request['id']}/close", headers=founder.headers)
    ).status_code == 200

    response = await api.post(
        f"/api/requests/{request['id']}/bids", json=bid_input(), headers=confirmed_builder.headers
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "request closed"


async def test_a_second_bid_by_the_same_builder_is_409(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)
    first = await bid(api, confirmed_builder, request["id"])

    second = await api.post(
        f"/api/requests/{request['id']}/bids",
        json=bid_input(dayRate=99),
        headers=confirmed_builder.headers,
    )

    assert second.status_code == 409
    assert second.json()["detail"] == "already bid"
    assert first["dayRate"] == 120


async def test_founder_is_403_no_profile_is_404_unknown_request_is_404_no_session_is_401(
    api: AsyncClient, founder: Actor, bearer: Bearer, db_session: AsyncSession
) -> None:
    db_session.add(User(clerk_id="user_noprofile", email="np@example.com", role="builder"))
    await db_session.commit()
    no_profile = bearer(sub="user_noprofile", role="builder")
    request = await publish(api, founder)

    as_founder = await api.post(
        f"/api/requests/{request['id']}/bids", json=bid_input(), headers=founder.headers
    )
    without_profile = await api.post(
        f"/api/requests/{request['id']}/bids", json=bid_input(), headers=no_profile
    )
    unknown = await api.post(
        "/api/requests/00000000-0000-0000-0000-000000000000/bids",
        json=bid_input(),
        headers=no_profile,
    )
    anonymous = await api.post(f"/api/requests/{request['id']}/bids", json=bid_input())

    assert as_founder.status_code == 403
    assert as_founder.json()["detail"] == "role builder required"
    assert without_profile.status_code == 404
    assert without_profile.json()["detail"] == "no profile yet"
    assert unknown.status_code == 404
    assert anonymous.status_code == 401


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"dayRate": 0}, "dayRate"),
        ({"dayRate": -5}, "dayRate"),
        ({"dayRate": 12.5}, "dayRate"),
        ({"message": "x" * 1001}, "message"),
    ],
)
async def test_invalid_bid_is_422_with_the_field_named(
    api: AsyncClient,
    founder: Actor,
    confirmed_builder: Actor,
    override: dict[str, Any],
    fragment: str,
) -> None:
    request = await publish(api, founder)

    response = await api.post(
        f"/api/requests/{request['id']}/bids",
        json=bid_input(**override),
        headers=confirmed_builder.headers,
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert fragment in response.json()["message"]


async def test_message_is_optional_and_defaults_to_empty(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)

    response = await api.post(
        f"/api/requests/{request['id']}/bids",
        json={"dayRate": 150},
        headers=confirmed_builder.headers,
    )

    assert response.status_code == 201
    assert response.json()["message"] == ""
