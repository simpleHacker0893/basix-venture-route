"""Seam: the booking state machine as a pure function (Sprint 004, #58; D-19 pure-function seam).

Spec #52 §Booking state machine, reading A chosen by the Operator (founder-owned): the builder
accepts or counters, the founder confirms or counters. Legal cells:

| From      | Action  | Actor   | To                   |
|-----------|---------|---------|----------------------|
| proposed  | accept  | builder | accepted             |
| proposed  | counter | builder | countered            |
| countered | confirm | founder | confirmed            |
| countered | counter | founder | proposed (new round) |
| accepted  | confirm | founder | confirmed            |

Every other cell raises `IllegalTransition(reason)`. A round starts at each propose and at each
founder counter; one counter per round per side is folded from the history here.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.marketplace.booking import (
    ACTIONS,
    ACTORS,
    STATES,
    IllegalTransition,
    Proposal,
    start,
    transition,
)

T0 = datetime(2026, 9, 23, 10, 0, tzinfo=UTC)
FIRST = Proposal(start=datetime(2026, 9, 24, 6, 0, tzinfo=UTC), duration_min=30, note="Intro call")
SECOND = Proposal(start=datetime(2026, 9, 25, 7, 30, tzinfo=UTC), duration_min=45, note="")
THIRD = Proposal(start=datetime(2026, 9, 28, 5, 0, tzinfo=UTC), duration_min=30, note="Later")

History = list[dict[str, Any]]


def at(step: int) -> datetime:
    return T0 + timedelta(minutes=step)


def _proposed() -> tuple[str, History]:
    return start(FIRST, at(0))


def _countered() -> tuple[str, History]:
    state, history = _proposed()
    return transition(state, history, "counter", "builder", SECOND, at(1))


def _accepted() -> tuple[str, History]:
    state, history = _proposed()
    return transition(state, history, "accept", "builder", None, at(1))


def _confirmed() -> tuple[str, History]:
    state, history = _countered()
    return transition(state, history, "confirm", "founder", None, at(2))


def _reproposed() -> tuple[str, History]:
    """After a founder counter: state `proposed`, a new round."""
    state, history = _countered()
    return transition(state, history, "counter", "founder", THIRD, at(2))


# -- the first entry ------------------------------------------------------------------------------


def test_start_writes_the_propose_entry() -> None:
    state, history = start(FIRST, at(0))

    assert state == "proposed"
    assert history == [
        {
            "action": "propose",
            "actor": "founder",
            "state": "proposed",
            "proposedStart": "2026-09-24T06:00:00+00:00",
            "durationMin": 30,
            "note": "Intro call",
            "at": "2026-09-23T10:00:00+00:00",
        }
    ]


# -- the five legal cells -------------------------------------------------------------------------

LEGAL: list[tuple[str, str, str, str]] = [
    ("proposed", "accept", "builder", "accepted"),
    ("proposed", "counter", "builder", "countered"),
    ("countered", "confirm", "founder", "confirmed"),
    ("countered", "counter", "founder", "proposed"),
    ("accepted", "confirm", "founder", "confirmed"),
]

_FROM = {"proposed": _proposed, "countered": _countered, "accepted": _accepted}


@pytest.mark.parametrize(("from_state", "action", "actor", "to_state"), LEGAL)
def test_legal_cells(from_state: str, action: str, actor: str, to_state: str) -> None:
    state, history = _FROM[from_state]()
    proposal = THIRD if action == "counter" else None

    new_state, new_history = transition(state, history, action, actor, proposal, at(9))

    assert new_state == to_state
    assert len(new_history) == len(history) + 1
    entry = new_history[-1]
    assert (entry["action"], entry["actor"], entry["state"]) == (action, actor, to_state)
    assert entry["at"] == "2026-09-23T10:09:00+00:00"
    if action == "counter":
        assert (entry["proposedStart"], entry["durationMin"], entry["note"]) == (
            "2026-09-28T05:00:00+00:00",
            30,
            "Later",
        )
    else:
        # accept and confirm carry the proposal on the table forward, unchanged
        assert (entry["proposedStart"], entry["durationMin"]) == (
            history[-1]["proposedStart"],
            history[-1]["durationMin"],
        )


# -- illegal cells --------------------------------------------------------------------------------


def _every_action_on_confirmed() -> list[tuple[str, str, str, str]]:
    return [
        (f"{action} by {actor} on confirmed", "confirmed", action, actor)
        for action in ACTIONS
        for actor in ACTORS
    ]


ILLEGAL: list[tuple[str, str, str, str]] = [
    *_every_action_on_confirmed(),
    ("accept by founder on proposed", "proposed", "accept", "founder"),
    ("accept by founder on countered", "countered", "accept", "founder"),
    ("accept by founder on accepted", "accepted", "accept", "founder"),
    ("accept by builder on countered", "countered", "accept", "builder"),
    ("accept by builder on accepted", "accepted", "accept", "builder"),
    ("confirm by builder on proposed", "proposed", "confirm", "builder"),
    ("confirm by builder on countered", "countered", "confirm", "builder"),
    ("confirm by builder on accepted", "accepted", "confirm", "builder"),
    ("confirm by founder on proposed", "proposed", "confirm", "founder"),
    ("counter on accepted by founder", "accepted", "counter", "founder"),
    ("counter on accepted by builder", "accepted", "counter", "builder"),
    ("counter by founder on proposed", "proposed", "counter", "founder"),
    ("a second builder counter in the same round", "countered", "counter", "builder"),
]

_STATE = {
    "proposed": _proposed,
    "countered": _countered,
    "accepted": _accepted,
    "confirmed": _confirmed,
}


@pytest.mark.parametrize(
    ("label", "from_state", "action", "actor"), ILLEGAL, ids=[c[0] for c in ILLEGAL]
)
def test_illegal_cells_raise_and_leave_the_history_alone(
    label: str, from_state: str, action: str, actor: str
) -> None:
    state, history = _STATE[from_state]()
    before = [dict(entry) for entry in history]

    with pytest.raises(IllegalTransition) as raised:
        transition(state, history, action, actor, THIRD, at(9))

    assert raised.value.reason, label
    assert history == before, "the input history is never mutated"


def test_a_second_founder_counter_in_the_same_round_is_illegal() -> None:
    state, history = _reproposed()
    assert state == "proposed"

    with pytest.raises(IllegalTransition):
        transition(state, history, "counter", "founder", SECOND, at(3))


def test_the_round_counter_names_the_side_that_already_countered() -> None:
    state, history = _countered()

    with pytest.raises(IllegalTransition, match="builder already countered this round"):
        transition(state, history, "counter", "builder", THIRD, at(3))


def test_counter_without_a_proposal_is_illegal() -> None:
    state, history = _proposed()

    with pytest.raises(IllegalTransition, match="proposal"):
        transition(state, history, "counter", "builder", None, at(1))


def test_any_action_on_confirmed_says_so() -> None:
    state, history = _confirmed()

    with pytest.raises(IllegalTransition, match="confirmed"):
        transition(state, history, "confirm", "founder", None, at(5))


def test_unknown_action_actor_or_state_is_illegal() -> None:
    state, history = _proposed()

    with pytest.raises(IllegalTransition):
        transition(state, history, "reject", "builder", None, at(1))
    with pytest.raises(IllegalTransition):
        transition(state, history, "accept", "admin", None, at(1))
    with pytest.raises(IllegalTransition):
        transition("cancelled", history, "accept", "builder", None, at(1))


# -- the acceptance round-trip and rounds ----------------------------------------------------------


def test_propose_counter_confirm_ends_confirmed_with_three_entries() -> None:
    state, history = start(FIRST, at(0))
    state, history = transition(state, history, "counter", "builder", SECOND, at(1))
    state, history = transition(state, history, "confirm", "founder", None, at(2))

    assert state == "confirmed"
    assert [entry["state"] for entry in history] == ["proposed", "countered", "confirmed"]
    assert [entry["action"] for entry in history] == ["propose", "counter", "confirm"]
    assert [entry["actor"] for entry in history] == ["founder", "builder", "founder"]
    # the confirmed time is the builder's counter
    assert history[-1]["proposedStart"] == "2026-09-25T07:30:00+00:00"
    assert history[-1]["durationMin"] == 45


def test_propose_accept_confirm_also_ends_confirmed() -> None:
    state, history = start(FIRST, at(0))
    state, history = transition(state, history, "accept", "builder", None, at(1))
    state, history = transition(state, history, "confirm", "founder", None, at(2))

    assert state == "confirmed"
    assert [entry["state"] for entry in history] == ["proposed", "accepted", "confirmed"]
    assert history[-1]["proposedStart"] == "2026-09-24T06:00:00+00:00"


def test_after_a_founder_counter_the_builder_may_counter_again() -> None:
    state, history = _reproposed()
    assert (state, len(history)) == ("proposed", 3)

    state, history = transition(state, history, "counter", "builder", SECOND, at(3))
    assert (state, len(history)) == ("countered", 4)

    state, history = transition(state, history, "confirm", "founder", None, at(4))
    assert (state, len(history)) == ("confirmed", 5)
    assert [entry["action"] for entry in history] == [
        "propose",
        "counter",
        "counter",
        "counter",
        "confirm",
    ]


def test_deterministic_given_now() -> None:
    state, history = _countered()

    first = transition(state, history, "confirm", "founder", None, at(2))
    second = transition(state, history, "confirm", "founder", None, at(2))

    assert first == second


def test_now_must_be_aware() -> None:
    state, history = _proposed()

    with pytest.raises(ValueError, match="aware"):
        transition(state, history, "accept", "builder", None, datetime(2026, 9, 23, 10, 1))


def test_vocabulary() -> None:
    assert STATES == ("proposed", "accepted", "countered", "confirmed")
    assert ACTIONS == ("accept", "counter", "confirm")
    assert ACTORS == ("founder", "builder")


def test_the_founder_may_counter_again_in_the_next_round() -> None:
    """A founder counter opens a new round (review of #65): propose → builder counter → founder
    counter → builder counter → founder counter is legal; the booking can still end confirmed."""
    state, history = _reproposed()
    state, history = transition(state, history, "counter", "builder", SECOND, at(3))
    assert state == "countered"

    state, history = transition(state, history, "counter", "founder", THIRD, at(4))

    assert (state, len(history)) == ("proposed", 5)
    state, history = transition(state, history, "counter", "builder", SECOND, at(5))
    state, history = transition(state, history, "confirm", "founder", None, at(6))
    assert (state, len(history)) == ("confirmed", 7)
