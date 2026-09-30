"""Seam: HTTP `POST /api/bookings` and `GET /api/me/bookings` with fake JWTs and per-test rollback
(Sprint 004, #64; D-19 seam one, spec #52 §HTTP API).

A founder proposes an interview slot to a confirmed builder inside the builder's confirmed
availability, on the 30-minute grid 08:00 to 18:00 Africa/Nairobi, for 30 or 45 minutes; both
parties list their bookings, upcoming first. Times are stored in UTC and rendered in Nairobi by
the engine (D-16). The confirmed cast builder is available 2026-09-22 to 2026-10-20.
"""

from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import Actor
from tests.test_requests import publish

pytestmark = pytest.mark.anyio

# 10:30 Africa/Nairobi on 2026-09-24, sent as UTC (07:30Z), inside Naomi's availability.
START_UTC = "2026-09-24T07:30:00Z"
START_LOCAL = "2026-09-24T10:30:00+03:00"


def booking_input(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "builderId": "naomi-chebet",
        "requestId": None,
        "proposedStart": START_UTC,
        "durationMin": 30,
        "note": "Intro call about the field survey app",
    }
    body.update(overrides)
    return body


async def propose(api: AsyncClient, founder: Actor, **overrides: Any) -> dict[str, Any]:
    response = await api.post(
        "/api/bookings", json=booking_input(**overrides), headers=founder.headers
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# -- propose -------------------------------------------------------------------------------------


async def test_founder_proposes_inside_the_builders_availability(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    request = await publish(api, founder)

    response = await api.post(
        "/api/bookings", json=booking_input(requestId=request["id"]), headers=founder.headers
    )

    assert response.status_code == 201
    body = response.json()
    assert body["state"] == "proposed"
    assert (body["builderId"], body["displayName"]) == ("naomi-chebet", "Naomi Chebet")
    assert body["founderId"] == "user_founder"
    assert (body["requestId"], body["requestTitle"]) == (request["id"], request["title"])
    assert body["proposedStart"] == "2026-09-24T07:30:00Z"
    assert body["proposedStartLocal"] == START_LOCAL
    assert (body["durationMin"], body["note"]) == (30, "Intro call about the field survey app")
    assert len(body["history"]) == 1
    entry = body["history"][0]
    assert (entry["action"], entry["actor"], entry["state"]) == ("propose", "founder", "proposed")
    assert (entry["proposedStart"], entry["proposedStartLocal"], entry["durationMin"]) == (
        "2026-09-24T07:30:00Z",
        START_LOCAL,
        30,
    )
    assert entry["note"] == body["note"]
    assert entry["at"]
    assert body["demoData"] is True
    assert body["id"] and body["createdAt"]


async def test_an_offset_start_is_normalised_to_utc_and_rendered_in_nairobi(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    body = await propose(api, founder, proposedStart="2026-09-24T10:30:00+03:00", durationMin=45)

    assert body["proposedStart"] == "2026-09-24T07:30:00Z"
    assert body["proposedStartLocal"] == START_LOCAL
    assert body["durationMin"] == 45


@pytest.mark.parametrize(
    ("override", "field", "fragment"),
    [
        (
            {"proposedStart": "2026-11-02T07:30:00Z"},
            "proposedStart",
            "outside the builder's confirmed availability",
        ),
        ({"proposedStart": "2026-09-24T07:15:00Z"}, "proposedStart", "30-minute grid"),
        ({"proposedStart": "2026-09-24T04:30:00Z"}, "proposedStart", "30-minute grid"),  # 07:30 EAT
        ({"proposedStart": "2026-09-24T15:30:00Z"}, "proposedStart", "30-minute grid"),  # 18:30 EAT
        ({"durationMin": 60}, "durationMin", "durationMin"),
        ({"proposedStart": "2026-09-24T07:30:00"}, "proposedStart", "proposedStart"),  # naive
        ({"note": "x" * 501}, "note", "note"),
    ],
)
async def test_slot_rule_violations_are_422_with_the_reason(
    api: AsyncClient,
    founder: Actor,
    confirmed_builder: Actor,
    override: dict[str, Any],
    field: str,
    fragment: str,
) -> None:
    response = await api.post(
        "/api/bookings", json=booking_input(**override), headers=founder.headers
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert field in response.json()["message"]
    assert fragment in response.json()["message"]


async def test_the_last_grid_start_at_18_00_is_accepted(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    body = await propose(api, founder, proposedStart="2026-10-06T15:00:00Z")

    assert body["proposedStartLocal"] == "2026-10-06T18:00:00+03:00"


async def test_only_confirmed_builders_can_be_booked(
    api: AsyncClient, founder: Actor, pending_builder: Actor
) -> None:
    unconfirmed = await api.post(
        "/api/bookings", json=booking_input(builderId="ali-hassan"), headers=founder.headers
    )
    seed_builder = await api.post(
        "/api/bookings", json=booking_input(builderId="amina-otieno"), headers=founder.headers
    )
    unknown = await api.post(
        "/api/bookings", json=booking_input(builderId="nobody"), headers=founder.headers
    )

    assert unconfirmed.status_code == 404
    assert unconfirmed.json()["detail"] == "no confirmed builder ali-hassan"
    assert seed_builder.status_code == 404
    assert unknown.status_code == 404


async def test_the_request_must_be_the_founders_own(
    api: AsyncClient, founder: Actor, other_founder: Actor, confirmed_builder: Actor
) -> None:
    theirs = await publish(api, other_founder, brief_id="brief-agri-01")

    not_mine = await api.post(
        "/api/bookings", json=booking_input(requestId=theirs["id"]), headers=founder.headers
    )
    unknown = await api.post(
        "/api/bookings",
        json=booking_input(requestId="00000000-0000-0000-0000-000000000000"),
        headers=founder.headers,
    )

    assert not_mine.status_code == 404
    assert unknown.status_code == 404


async def test_builder_token_is_403_and_no_session_is_401(
    api: AsyncClient, confirmed_builder: Actor
) -> None:
    as_builder = await api.post(
        "/api/bookings", json=booking_input(), headers=confirmed_builder.headers
    )
    anonymous = await api.post("/api/bookings", json=booking_input())

    assert as_builder.status_code == 403
    assert as_builder.json()["detail"] == "role founder required"
    assert anonymous.status_code == 401


# -- list ----------------------------------------------------------------------------------------


async def test_both_parties_see_the_booking_and_nobody_else_does(
    api: AsyncClient,
    founder: Actor,
    other_founder: Actor,
    confirmed_builder: Actor,
    rejected_builder: Actor,
) -> None:
    booking = await propose(api, founder)

    as_founder = await api.get("/api/me/bookings", headers=founder.headers)
    as_builder = await api.get("/api/me/bookings", headers=confirmed_builder.headers)
    as_other_founder = await api.get("/api/me/bookings", headers=other_founder.headers)
    as_other_builder = await api.get("/api/me/bookings", headers=rejected_builder.headers)
    anonymous = await api.get("/api/me/bookings")

    assert as_founder.status_code == 200
    assert as_founder.json() == [booking]
    assert as_builder.status_code == 200
    assert as_builder.json() == [booking]
    assert as_other_founder.json() == []
    assert as_other_builder.json() == []
    assert anonymous.status_code == 401


async def test_bookings_list_upcoming_first_with_both_time_fields(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    later = await propose(api, founder, proposedStart="2026-10-01T06:00:00Z")
    sooner = await propose(api, founder, proposedStart="2026-09-25T06:00:00Z", durationMin=45)

    response = await api.get("/api/me/bookings", headers=founder.headers)

    assert [(b["id"], b["proposedStartLocal"]) for b in response.json()] == [
        (sooner["id"], "2026-09-25T09:00:00+03:00"),
        (later["id"], "2026-10-01T09:00:00+03:00"),
    ]
    assert all(b["proposedStart"].endswith("Z") for b in response.json())
