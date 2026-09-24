"""Seam: HTTP `POST /api/bookings/{id}/{accept|counter|confirm}` with fake JWTs and per-test
rollback (Sprint 004, #65; D-19 seam one, spec #52 §Booking state machine and §HTTP API).

The booking moves through the founder-owned machine (#58) over HTTP: each endpoint locks the
row, calls the pure `transition`, maps `IllegalTransition` to 409 with its reason, and writes
state, history, proposed start and duration in one UPDATE. Anyone who is not a party gets 404.
"""

from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import Actor
from tests.test_bookings import propose

pytestmark = pytest.mark.anyio

# Wednesday 2026-09-25 09:00 Africa/Nairobi, 45 minutes: inside Naomi's availability.
COUNTER = {"proposedStart": "2026-09-25T06:00:00Z", "durationMin": 45, "note": "Morning suits me"}
COUNTER_LOCAL = "2026-09-25T09:00:00+03:00"
# The founder's counter of the counter: 2026-09-28 14:00 Africa/Nairobi, 30 minutes.
RECOUNTER = {"proposedStart": "2026-09-28T11:00:00Z", "durationMin": 30, "note": "Monday then"}


async def act(
    api: AsyncClient, who: Actor, booking_id: str, action: str, body: dict[str, Any] | None = None
) -> Any:
    return await api.post(f"/api/bookings/{booking_id}/{action}", json=body, headers=who.headers)


# -- the acceptance round-trip -----------------------------------------------------------------


async def test_founder_proposes_builder_counters_founder_confirms(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)

    countered = await act(api, confirmed_builder, booking["id"], "counter", COUNTER)
    confirmed = await act(api, founder, booking["id"], "confirm")

    assert countered.status_code == 200, countered.text
    assert countered.json()["state"] == "countered"
    assert (countered.json()["proposedStart"], countered.json()["proposedStartLocal"]) == (
        "2026-09-25T06:00:00Z",
        COUNTER_LOCAL,
    )
    assert countered.json()["durationMin"] == 45
    assert confirmed.status_code == 200, confirmed.text
    body = confirmed.json()
    assert body["state"] == "confirmed"
    assert [entry["action"] for entry in body["history"]] == ["propose", "counter", "confirm"]
    assert [entry["actor"] for entry in body["history"]] == ["founder", "builder", "founder"]
    assert [entry["state"] for entry in body["history"]] == ["proposed", "countered", "confirmed"]
    assert (body["proposedStart"], body["proposedStartLocal"], body["durationMin"]) == (
        "2026-09-25T06:00:00Z",
        COUNTER_LOCAL,
        45,
    )
    assert body["history"][-1]["proposedStartLocal"] == COUNTER_LOCAL
    assert body["history"][1]["note"] == "Morning suits me"
    listed = (await api.get("/api/me/bookings", headers=confirmed_builder.headers)).json()
    assert listed == [body], "the list reads the same row"


async def test_builder_accepts_and_founder_confirms(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)

    accepted = await act(api, confirmed_builder, booking["id"], "accept")
    confirmed = await act(api, founder, booking["id"], "confirm")

    assert accepted.status_code == 200
    assert accepted.json()["state"] == "accepted"
    assert accepted.json()["proposedStartLocal"] == booking["proposedStartLocal"]
    assert confirmed.json()["state"] == "confirmed"
    assert [entry["action"] for entry in confirmed.json()["history"]] == [
        "propose",
        "accept",
        "confirm",
    ]


async def test_after_a_founder_counter_the_builder_may_counter_again(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)
    assert (await act(api, confirmed_builder, booking["id"], "counter", COUNTER)).status_code == 200

    reproposed = await act(api, founder, booking["id"], "counter", RECOUNTER)
    again = await act(api, confirmed_builder, booking["id"], "counter", COUNTER)

    assert reproposed.status_code == 200
    assert reproposed.json()["state"] == "proposed"
    assert reproposed.json()["proposedStartLocal"] == "2026-09-28T14:00:00+03:00"
    assert again.status_code == 200
    assert again.json()["state"] == "countered"
    assert len(again.json()["history"]) == 4


# -- illegal transitions are 409 with the machine's reason ----------------------------------------


async def test_illegal_transitions_are_409(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)

    founder_accept = await act(api, founder, booking["id"], "accept")
    builder_confirm = await act(api, confirmed_builder, booking["id"], "confirm")
    founder_confirm_early = await act(api, founder, booking["id"], "confirm")

    assert founder_accept.status_code == 409
    assert "accept" in founder_accept.json()["detail"]
    assert builder_confirm.status_code == 409
    assert founder_confirm_early.status_code == 409
    assert (await api.get("/api/me/bookings", headers=founder.headers)).json()[0][
        "state"
    ] == "proposed", "a refused action changes nothing"


async def test_a_second_builder_counter_in_the_same_round_is_409(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)
    assert (await act(api, confirmed_builder, booking["id"], "counter", COUNTER)).status_code == 200

    response = await act(api, confirmed_builder, booking["id"], "counter", RECOUNTER)

    assert response.status_code == 409
    assert response.json()["detail"] == "the builder already countered this round"


async def test_any_action_on_a_confirmed_booking_is_409(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)
    assert (await act(api, confirmed_builder, booking["id"], "accept")).status_code == 200
    assert (await act(api, founder, booking["id"], "confirm")).status_code == 200

    for who, action, body in (
        (founder, "confirm", None),
        (founder, "counter", COUNTER),
        (confirmed_builder, "accept", None),
        (confirmed_builder, "counter", COUNTER),
    ):
        response = await act(api, who, booking["id"], action, body)
        assert response.status_code == 409, (action, response.text)
        assert "confirmed" in response.json()["detail"]


# -- the counter proposal follows the slot rules ---------------------------------------------------


@pytest.mark.parametrize(
    ("override", "fragment"),
    [
        ({"proposedStart": "2026-09-25T06:10:00Z"}, "30-minute grid"),
        ({"proposedStart": "2026-11-02T06:00:00Z"}, "outside the builder's confirmed availability"),
        ({"durationMin": 60}, "durationMin"),
        ({"proposedStart": "2026-09-25T06:00:00"}, "proposedStart"),
    ],
)
async def test_a_counter_off_the_rules_is_422_and_changes_nothing(
    api: AsyncClient,
    founder: Actor,
    confirmed_builder: Actor,
    override: dict[str, Any],
    fragment: str,
) -> None:
    booking = await propose(api, founder)

    response = await act(api, confirmed_builder, booking["id"], "counter", {**COUNTER, **override})

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert fragment in response.json()["message"]
    current = (await api.get("/api/me/bookings", headers=founder.headers)).json()[0]
    assert (current["state"], len(current["history"])) == ("proposed", 1)


async def test_a_counter_needs_a_body(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    booking = await propose(api, founder)

    response = await act(api, confirmed_builder, booking["id"], "counter")

    assert response.status_code == 422


# -- parties only --------------------------------------------------------------------------------


async def test_non_parties_get_404_and_no_session_401(
    api: AsyncClient,
    founder: Actor,
    other_founder: Actor,
    confirmed_builder: Actor,
    rejected_builder: Actor,
) -> None:
    booking = await propose(api, founder)

    for who in (other_founder, rejected_builder):
        for action, body in (("accept", None), ("counter", COUNTER), ("confirm", None)):
            response = await act(api, who, booking["id"], action, body)
            assert response.status_code == 404, (who.clerk_id, action, response.text)
    unknown = await act(api, founder, "00000000-0000-0000-0000-000000000000", "confirm")
    anonymous = await api.post(f"/api/bookings/{booking['id']}/accept")

    assert unknown.status_code == 404
    assert anonymous.status_code == 401
    current = (await api.get("/api/me/bookings", headers=founder.headers)).json()[0]
    assert (current["state"], len(current["history"])) == ("proposed", 1)


async def test_a_counter_with_a_bad_slot_on_a_confirmed_booking_is_409_not_422(
    api: AsyncClient, founder: Actor, confirmed_builder: Actor
) -> None:
    """Requirements edge case: counter-proposal on a confirmed booking → 409, whatever the body."""
    booking = await propose(api, founder)
    assert (await act(api, confirmed_builder, booking["id"], "accept")).status_code == 200
    assert (await act(api, founder, booking["id"], "confirm")).status_code == 200

    response = await act(
        api,
        confirmed_builder,
        booking["id"],
        "counter",
        {**COUNTER, "proposedStart": "2026-09-25T06:10:00Z"},
    )

    assert response.status_code == 409
    assert "confirmed" in response.json()["detail"]
