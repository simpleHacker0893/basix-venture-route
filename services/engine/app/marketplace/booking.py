"""The booking state machine as a pure function (Sprint 004, spec #52 §Booking state machine, #58).

Founder-owned (reading A, chosen by the Operator): the builder accepts or counters, the founder
confirms or counters. `transition` folds the history to enforce "one counter per round per side"
and appends one entry per action; the API writes state and history in one UPDATE (#65) so the
two never disagree. Imports nothing from the API or the store; deterministic given `now`.

| From      | Action  | Actor   | To                   |
|-----------|---------|---------|----------------------|
| proposed  | accept  | builder | accepted             |
| proposed  | counter | builder | countered            |
| countered | confirm | founder | confirmed            |
| countered | counter | founder | proposed (new round) |
| accepted  | confirm | founder | confirmed            |
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

STATES = ("proposed", "accepted", "countered", "confirmed")
ACTIONS = ("accept", "counter", "confirm")
ACTORS = ("founder", "builder")

# (from state, action, actor) -> to state. Every cell not listed is illegal.
TABLE: dict[tuple[str, str, str], str] = {
    ("proposed", "accept", "builder"): "accepted",
    ("proposed", "counter", "builder"): "countered",
    ("countered", "confirm", "founder"): "confirmed",
    ("countered", "counter", "founder"): "proposed",
    ("accepted", "confirm", "founder"): "confirmed",
}

HistoryEntry = dict[str, Any]


class IllegalTransition(Exception):
    """A cell outside the table, or a second counter by the same side in one round."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Proposal:
    """A proposed slot: an aware start (stored in UTC, D-16), 30 or 45 minutes, an optional note.
    Slot rules are the API's job (`slots.valid_slot`); the machine only records the proposal."""

    start: datetime
    duration_min: int
    note: str = ""


def _require_aware(value: datetime, what: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{what} must be an aware datetime")


def _entry(action: str, actor: str, state: str, proposal: Proposal, now: datetime) -> HistoryEntry:
    _require_aware(proposal.start, "proposedStart")
    return {
        "action": action,
        "actor": actor,
        "state": state,
        "proposedStart": proposal.start.isoformat(),
        "durationMin": proposal.duration_min,
        "note": proposal.note,
        "at": now.isoformat(),
    }


def _on_the_table(history: list[HistoryEntry]) -> Proposal:
    """The proposal the parties are acting on: the latest entry's slot."""
    latest = history[-1]
    return Proposal(
        start=datetime.fromisoformat(latest["proposedStart"]),
        duration_min=int(latest["durationMin"]),
        note=str(latest.get("note", "")),
    )


def _counters_this_round(history: list[HistoryEntry]) -> dict[str, int]:
    """Counters per side since the round began. A round opens with the founder's proposal or
    with a founder counter; the opening entry belongs to the previous round, so a founder
    counter never counts against the founder in the round it opens (review of #65)."""
    round_start = 0
    for index, entry in enumerate(history):
        if entry["action"] == "propose" or (
            entry["action"] == "counter" and entry["actor"] == "founder"
        ):
            round_start = index
    counts = {actor: 0 for actor in ACTORS}
    for entry in history[round_start + 1 :]:
        if entry["action"] == "counter":
            counts[str(entry["actor"])] += 1
    return counts


def start(proposal: Proposal, now: datetime) -> tuple[str, list[HistoryEntry]]:
    """The founder's proposal: state `proposed` and the first history entry."""
    _require_aware(now, "now")
    return "proposed", [_entry("propose", "founder", "proposed", proposal, now)]


def check(state: str, history: list[HistoryEntry], action: str, actor: str) -> str:
    """The state the action would lead to, or `IllegalTransition(reason)`: the confirmed
    guard, the vocabulary, the once-per-round counter rule and the table. Callers that must
    validate a proposal body run this first so an illegal cell answers 409 before a bad slot
    answers 422 (requirements edge case: counter on a confirmed booking → 409)."""
    if state == "confirmed":
        raise IllegalTransition("the booking is confirmed; no further action is possible")
    if state not in STATES or action not in ACTIONS or actor not in ACTORS:
        raise IllegalTransition(f"{action} by the {actor} is not a booking transition from {state}")
    if action == "counter" and _counters_this_round(history)[actor] >= 1:
        raise IllegalTransition(f"the {actor} already countered this round")
    to_state = TABLE.get((state, action, actor))
    if to_state is None:
        raise IllegalTransition(
            f"{action} is not allowed for the {actor} while the booking is {state}"
        )
    return to_state


def transition(
    state: str,
    history: list[HistoryEntry],
    action: str,
    actor: str,
    proposal: Proposal | None,
    now: datetime,
) -> tuple[str, list[HistoryEntry]]:
    """Apply one action; returns the new state and a new history list with one entry appended.
    Raises `IllegalTransition(reason)` for every cell outside the table."""
    _require_aware(now, "now")
    to_state = check(state, history, action, actor)
    if action == "counter" and proposal is None:
        raise IllegalTransition("counter needs a proposal")
    slot = proposal if action == "counter" and proposal is not None else _on_the_table(history)
    return to_state, [*history, _entry(action, actor, to_state, slot, now)]
