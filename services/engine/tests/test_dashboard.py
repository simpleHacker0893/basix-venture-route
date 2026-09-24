"""Seam: HTTP `GET /api/me/dashboard` with fake JWTs and per-test rollback (Sprint 004, #66;
D-19 seam one, spec #52 §HTTP API). Acceptance Must 4: "Founder dashboard tiles match SQL
counts", so every field of `counts` is compared with a direct SQL count run in the same
rolled-back transaction (the comparison the acceptance asks for, not a judgement).

Numbers come from SQL, never from the engine (D-17).
"""

from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.marketplace.models import User
from tests.conftest import (
    MOBILE_CREDENTIAL,
    MOBILE_PROJECT,
    Actor,
    Decide,
    builder_profile_input,
)
from tests.test_bids import bid
from tests.test_bookings import propose
from tests.test_requests import publish

pytestmark = pytest.mark.anyio


async def _count(session: AsyncSession, sql: str, **params: Any) -> int:
    value = (await session.execute(text(sql), params)).scalar()
    return int(value or 0)


async def _sql_counts(session: AsyncSession, founder_id: UUID) -> dict[str, Any]:
    """The tiles as direct SQL over the founder's rows (spec #52 §Dashboard response)."""
    by_status = {
        status: await _count(
            session,
            "select count(*) from requests where founder_id = :f and route_status = :s",
            f=founder_id,
            s=status,
        )
        for status in ("feasible", "partial", "infeasible")
    }
    return {
        "briefs": await _count(
            session, "select count(*) from requests where founder_id = :f", f=founder_id
        ),
        "routes": by_status,
        "openRequests": await _count(
            session,
            "select count(*) from requests where founder_id = :f and status = 'open'",
            f=founder_id,
        ),
        "bidsReceived": await _count(
            session,
            "select count(*) from bids b join requests r on r.id = b.request_id"
            " join profiles p on p.id = b.profile_id join users u on u.id = p.user_id"
            " where r.founder_id = :f and u.status = 'confirmed'",
            f=founder_id,
        ),
        "bookings": await _count(
            session, "select count(*) from bookings where founder_id = :f", f=founder_id
        ),
    }


async def test_tiles_equal_direct_sql_counts_and_lists_follow_the_rules(
    api: AsyncClient,
    founder: Actor,
    confirmed_builder: Actor,
    rejected_builder: Actor,
    decide: Decide,
    db_session: AsyncSession,
) -> None:
    # four requests: Health (feasible), Budget (partial, D-22), Constrained (feasible now that
    # Naomi is confirmed), Agri (feasible, then closed)
    health = await publish(api, founder, brief_id="brief-health-01")
    budget = await publish(api, founder, brief_id="brief-budget-01")
    constrained = await publish(api, founder)
    agri = await publish(api, founder, brief_id="brief-agri-01")
    assert (
        await api.post(f"/api/requests/{agri['id']}/close", headers=founder.headers)
    ).status_code == 200
    # two bids on the Constrained request, then Esther is un-confirmed
    naomi_bid = await bid(api, confirmed_builder, constrained["id"])
    await bid(api, rejected_builder, constrained["id"], dayRate=95)
    await decide(rejected_builder, {"account": "rejected"})
    # two bookings against the fixed test clock (2026-09-23 00:00 UTC, conftest TEST_NOW):
    # one in the past (2026-09-22 08:00 EAT), one upcoming (2026-09-24 10:30 EAT)
    past = await propose(api, founder, proposedStart="2026-09-22T05:00:00Z")
    upcoming = await propose(
        api, founder, proposedStart="2026-09-24T07:30:00Z", requestId=constrained["id"]
    )

    response = await api.get("/api/me/dashboard", headers=founder.headers)

    assert response.status_code == 200
    body = response.json()
    assert body["counts"] == await _sql_counts(db_session, founder.user_id)
    assert body["counts"] == {
        "briefs": 4,
        "routes": {"feasible": 3, "partial": 1, "infeasible": 0},
        "openRequests": 3,
        "bidsReceived": 1,
        "bookings": 2,
    }
    assert [(r["id"], r["status"], r["routeStatus"]) for r in body["requests"]] == [
        (agri["id"], "closed", "feasible"),
        (constrained["id"], "open", "feasible"),
        (budget["id"], "open", "partial"),
        (health["id"], "open", "feasible"),
    ], "newest first, every status, with the route snapshot"
    assert all(r["eligibility"] is None for r in body["requests"])
    assert [(b["id"], b["builderId"]) for b in body["bidsReceived"]] == [
        (naomi_bid["id"], "naomi-chebet")
    ], "the un-confirmed builder's bid is excluded"
    assert [(b["id"], b["proposedStartLocal"]) for b in body["upcomingBookings"]] == [
        (upcoming["id"], "2026-09-24T10:30:00+03:00")
    ], "the past booking is excluded"
    assert past["id"] not in [b["id"] for b in body["upcomingBookings"]]


async def test_bids_received_is_capped_at_ten_newest_first(
    api: AsyncClient,
    founder: Actor,
    confirmed_builder: Actor,
    decide: Decide,
    db_session: AsyncSession,
    bearer: Any,
) -> None:
    request = await publish(api, founder)
    await bid(api, confirmed_builder, request["id"])
    placed: list[str] = []
    for index in range(10):
        clerk_id = f"user_extra_{index}"
        db_session.add(User(clerk_id=clerk_id, email=f"extra{index}@example.com", role="builder"))
        await db_session.commit()
        headers = bearer(sub=clerk_id, role="builder")
        profile = await api.put(
            "/api/me/profile", json=builder_profile_input(f"Extra Builder {index}"), headers=headers
        )
        credential = await api.post("/api/me/credentials", json=MOBILE_CREDENTIAL, headers=headers)
        project = await api.post("/api/me/projects", json=MOBILE_PROJECT, headers=headers)
        assert (profile.status_code, credential.status_code, project.status_code) == (200, 201, 201)
        user_id = (
            await db_session.execute(
                text("select id from users where clerk_id = :c"), {"c": clerk_id}
            )
        ).scalar()
        extra = Actor(
            clerk_id=clerk_id,
            role="builder",
            headers=headers,
            user_id=UUID(str(user_id)),
            builder_id=profile.json()["builderId"],
            ids={
                "account": str(user_id),
                "credential": credential.json()["id"],
                "project": project.json()["id"],
            },
        )
        await decide(extra, {"account": "confirmed", "credential": "confirmed"})
        placed.append((await bid(api, extra, request["id"], dayRate=100 + index))["id"])

    body = (await api.get("/api/me/dashboard", headers=founder.headers)).json()

    assert (
        body["counts"]["bidsReceived"]
        == 11
        == await _count(
            db_session,
            "select count(*) from bids b join requests r on r.id = b.request_id"
            " where r.founder_id = :f",
            f=founder.user_id,
        )
    )
    assert len(body["bidsReceived"]) == 10
    assert [b["id"] for b in body["bidsReceived"]] == list(reversed(placed)), "newest ten"


async def test_a_founder_with_nothing_sees_zeros_and_empty_lists(
    api: AsyncClient, founder: Actor
) -> None:
    response = await api.get("/api/me/dashboard", headers=founder.headers)

    assert response.status_code == 200
    assert response.json() == {
        "counts": {
            "briefs": 0,
            "routes": {"feasible": 0, "partial": 0, "infeasible": 0},
            "openRequests": 0,
            "bidsReceived": 0,
            "bookings": 0,
        },
        "requests": [],
        "bidsReceived": [],
        "upcomingBookings": [],
    }


async def test_dashboard_is_founder_only(
    api: AsyncClient, confirmed_builder: Actor, admin: Actor
) -> None:
    as_builder = await api.get("/api/me/dashboard", headers=confirmed_builder.headers)
    as_admin = await api.get("/api/me/dashboard", headers=admin.headers)
    anonymous = await api.get("/api/me/dashboard")

    assert as_builder.status_code == 403
    assert as_builder.json()["detail"] == "role founder required"
    assert as_admin.status_code == 403
    assert anonymous.status_code == 401
