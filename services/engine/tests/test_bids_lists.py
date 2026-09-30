"""Seam: HTTP `GET /api/requests/{id}/bids` (founder owner) and `GET /api/me/bids` (builder) with
fake JWTs and per-test rollback (Sprint 004, #63; D-19 seam one, spec #52 §HTTP API).

The founder sees bids from builders whose account is currently confirmed; a bid from a builder
who has since been un-confirmed is hidden, not deleted, and returns when the account is confirmed
again (DOMAIN.md §Marketplace rules). The builder tracks their own bids with the request's title
and status.
"""

from collections.abc import Callable

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.conftest import Actor, Decide
from tests.test_bids import bid
from tests.test_requests import publish

pytestmark = pytest.mark.anyio

Bearer = Callable[..., dict[str, str]]


# -- the founder's list ---------------------------------------------------------------------------


async def test_founder_sees_the_confirmed_builders_bid_with_skills_and_path(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)
    placed = await bid(api, confirmed_builder, request["id"])

    response = await api.get(f"/api/requests/{request['id']}/bids", headers=founder.headers)

    assert response.status_code == 200
    assert response.json() == [placed]
    assert response.json()[0]["eligibleSkills"] == ["mobile"]
    assert response.json()[0]["path"]["rule"] == "eligible-builder"


async def test_a_bid_is_hidden_while_the_builder_is_unconfirmed_and_returns_on_confirm(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor, decide: Decide
) -> None:
    request = await publish(api, founder)
    placed = await bid(api, confirmed_builder, request["id"])

    await decide(confirmed_builder, {"account": "rejected"})
    hidden = await api.get(f"/api/requests/{request['id']}/bids", headers=founder.headers)
    await decide(confirmed_builder, {"account": "confirmed"})
    visible = await api.get(f"/api/requests/{request['id']}/bids", headers=founder.headers)

    assert hidden.status_code == 200
    assert hidden.json() == []
    assert [b["id"] for b in visible.json()] == [placed["id"]], "hidden, never deleted"


async def test_bids_are_listed_newest_first(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor, rejected_builder: Actor
) -> None:
    """Esther Wanjala (project rejected, credential confirmed) is still verified for mobile."""
    request = await publish(api, founder)
    first = await bid(api, confirmed_builder, request["id"])
    second = await bid(api, rejected_builder, request["id"], dayRate=95)

    response = await api.get(f"/api/requests/{request['id']}/bids", headers=founder.headers)

    assert [(b["id"], b["builderId"], b["dayRate"]) for b in response.json()] == [
        (second["id"], "esther-wanjala", 95),
        (first["id"], "naomi-chebet", 120),
    ]


async def test_only_the_owning_founder_lists_bids(
    api: AsyncClient, founder: Actor, other_founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)
    await bid(api, confirmed_builder, request["id"])

    other = await api.get(f"/api/requests/{request['id']}/bids", headers=other_founder.headers)
    builder = await api.get(
        f"/api/requests/{request['id']}/bids", headers=confirmed_builder.headers
    )
    unknown = await api.get(
        "/api/requests/00000000-0000-0000-0000-000000000000/bids", headers=founder.headers
    )
    anonymous = await api.get(f"/api/requests/{request['id']}/bids")

    assert other.status_code == 404
    assert builder.status_code == 403
    assert builder.json()["detail"] == "role founder required"
    assert unknown.status_code == 404
    assert anonymous.status_code == 401


async def test_an_open_request_with_no_bids_lists_empty(api: AsyncClient, founder: Actor) -> None:
    request = await publish(api, founder)

    response = await api.get(f"/api/requests/{request['id']}/bids", headers=founder.headers)

    assert response.status_code == 200
    assert response.json() == []


# -- the builder's own bids ---------------------------------------------------------------------


async def test_builder_sees_own_bids_with_the_request_title_and_status(
    api: AsyncClient, founder: Actor, other_founder: Actor, confirmed_builder: Actor
) -> None:
    constrained = await publish(api, founder)
    agri = await publish(api, other_founder, brief_id="brief-agri-01")
    mine = await bid(api, confirmed_builder, constrained["id"])
    assert (
        await api.post(
            f"/api/requests/{agri['id']}/bids",
            json={"dayRate": 120},
            headers=confirmed_builder.headers,
        )
    ).status_code == 403, "not eligible for the Agri brief"

    before = await api.get("/api/me/bids", headers=confirmed_builder.headers)
    assert (
        await api.post(f"/api/requests/{constrained['id']}/close", headers=founder.headers)
    ).status_code == 200
    after = await api.get("/api/me/bids", headers=confirmed_builder.headers)

    assert before.status_code == 200
    assert [(b["id"], b["requestTitle"], b["requestStatus"]) for b in before.json()] == [
        (mine["id"], constrained["title"], "open")
    ]
    assert [(b["id"], b["requestStatus"]) for b in after.json()] == [(mine["id"], "closed")]


async def test_my_bids_are_builder_only_and_need_a_profile(
    api: AsyncClient, founder: Actor, bearer: Bearer, db_session: AsyncSession
) -> None:
    db_session.add(User(clerk_id="user_noprofile", email="np@example.com", role="builder"))
    await db_session.commit()

    as_founder = await api.get("/api/me/bids", headers=founder.headers)
    no_profile = await api.get("/api/me/bids", headers=bearer(sub="user_noprofile", role="builder"))
    anonymous = await api.get("/api/me/bids")

    assert as_founder.status_code == 403
    assert no_profile.status_code == 404
    assert no_profile.json()["detail"] == "no profile yet"
    assert anonymous.status_code == 401
