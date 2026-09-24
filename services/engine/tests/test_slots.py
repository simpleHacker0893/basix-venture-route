"""Seam: the slot rules and the Africa/Nairobi presenter as pure functions (Sprint 004, #57;
D-19 pure-function seam, D-16 stored UTC with the zone applied in the presenter).

Spec #52 §HTTP API, slot rules chosen by the Operator: any date inside the builder's confirmed
availability ranges, any start on the 30-minute grid from 08:00 to 18:00 Africa/Nairobi,
duration 30 or 45 minutes, no buffer. The module imports nothing from the API or the store.
"""

from datetime import UTC, date, datetime, timedelta, timezone

import pytest

from app.marketplace.slots import (
    DURATIONS,
    GRID_MINUTES,
    NAIROBI,
    to_nairobi,
    valid_slot,
)

RANGES = [(date(2026, 9, 22), date(2026, 10, 6)), (date(2026, 10, 20), date(2026, 10, 22))]


def eat(day: date, hour: int, minute: int = 0) -> datetime:
    """A wall-clock instant in Africa/Nairobi (UTC+3), returned as an aware UTC datetime."""
    local = datetime(day.year, day.month, day.day, hour, minute, tzinfo=NAIROBI)
    return local.astimezone(UTC)


OK = None
OUTSIDE = "outside"
GRID = "grid"
DURATION = "duration"

TABLE: list[tuple[str, datetime, int, str | None]] = [
    ("inside the range, on the grid", eat(date(2026, 9, 24), 10, 30), 30, OK),
    ("a day outside every range", eat(date(2026, 10, 10), 10, 0), 30, OUTSIDE),
    ("minutes off the grid", eat(date(2026, 9, 24), 10, 15), 30, GRID),
    ("07:30, before the first grid start", eat(date(2026, 9, 24), 7, 30), 30, GRID),
    ("08:00, the first grid start", eat(date(2026, 9, 22), 8, 0), 45, OK),
    ("18:00, the last grid start", eat(date(2026, 10, 6), 18, 0), 30, OK),
    ("18:30, after the last grid start", eat(date(2026, 10, 6), 18, 30), 30, GRID),
    ("duration 60", eat(date(2026, 9, 24), 10, 0), 60, DURATION),
    ("duration 15", eat(date(2026, 9, 24), 10, 0), 15, DURATION),
    ("the second range counts too", eat(date(2026, 10, 21), 9, 0), 45, OK),
    ("seconds off the grid", eat(date(2026, 9, 24), 10, 0) + timedelta(seconds=1), 30, GRID),
    # 2026-09-21T22:00Z is 01:00 on 2026-09-22 in Nairobi: inside the range by the Nairobi date
    # (so the day rule passes) and off the grid, which is what the reason must say.
    (
        "previous day in UTC, inside the range in Nairobi",
        datetime(2026, 9, 21, 22, 0, tzinfo=UTC),
        30,
        GRID,
    ),
    # 2026-10-06T21:30Z is still the range's last day in UTC but 00:30 on 2026-10-07 in Nairobi.
    (
        "same day in UTC, the next day in Nairobi",
        datetime(2026, 10, 6, 21, 30, tzinfo=UTC),
        30,
        OUTSIDE,
    ),
]


@pytest.mark.parametrize(
    ("label", "start", "duration", "expected"), TABLE, ids=[t[0] for t in TABLE]
)
def test_valid_slot_table(label: str, start: datetime, duration: int, expected: str | None) -> None:
    reason = valid_slot(start, duration, RANGES)

    if expected is OK:
        assert reason is None, label
    else:
        assert reason is not None, label
        assert expected in reason.lower(), (label, reason)


def test_the_reasons_are_the_sentences_the_api_returns() -> None:
    assert valid_slot(eat(date(2026, 10, 10), 10, 0), 30, RANGES) == (
        "start is outside the builder's confirmed availability (2026-10-10 is in no range)"
    )
    assert valid_slot(eat(date(2026, 9, 24), 10, 15), 30, RANGES) == (
        "start must be on the 30-minute grid between 08:00 and 18:00 Africa/Nairobi"
    )
    assert valid_slot(eat(date(2026, 9, 24), 10, 0), 60, RANGES) == (
        "duration must be 30 or 45 minutes"
    )


def test_no_availability_means_every_day_is_outside() -> None:
    assert valid_slot(eat(date(2026, 9, 24), 10, 0), 30, []) is not None


def test_a_naive_start_is_rejected() -> None:
    with pytest.raises(ValueError, match="aware"):
        valid_slot(datetime(2026, 9, 24, 7, 0), 30, RANGES)


def test_constants_match_the_spec() -> None:
    assert DURATIONS == (30, 45)
    assert GRID_MINUTES == 30


# -- presenter ---------------------------------------------------------------------------------


def test_to_nairobi_renders_the_plus_three_offset() -> None:
    assert to_nairobi(datetime(2026, 9, 24, 7, 30, tzinfo=UTC)) == "2026-09-24T10:30:00+03:00"
    assert to_nairobi(datetime(2026, 9, 21, 22, 0, tzinfo=UTC)) == "2026-09-22T01:00:00+03:00"


def test_to_nairobi_accepts_any_aware_zone() -> None:
    plus_two = datetime(2026, 9, 24, 9, 30, tzinfo=timezone(timedelta(hours=2)))

    assert to_nairobi(plus_two) == "2026-09-24T10:30:00+03:00"


def test_to_nairobi_rejects_naive_datetimes() -> None:
    with pytest.raises(ValueError, match="aware"):
        to_nairobi(datetime(2026, 9, 24, 7, 30))
