"""Booking slot rules and the Africa/Nairobi presenter (Sprint 004, spec #52 §HTTP API, #57).

Pure functions, imported by the create and counter endpoints so every proposal is validated the
same way and every BookingOut renders `proposedStartLocal` the same way. Times are stored in UTC
and the zone is applied here (D-16). The rules the Operator chose: any date inside the builder's
confirmed availability ranges, any start on the 30-minute grid from 08:00 to 18:00 Africa/Nairobi
(18:00 is the last start), duration 30 or 45 minutes, no buffer. Stitch's four fixed slots and
"30-min buffer" are not adopted (D-36 substitution). This module imports nothing from the API or
the store.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone

NAIROBI = timezone(timedelta(hours=3), name="Africa/Nairobi")
GRID_MINUTES = 30
FIRST_START = time(8, 0)
LAST_START = time(18, 0)
DURATIONS = (30, 45)

OUTSIDE_AVAILABILITY = (
    "start is outside the builder's confirmed availability ({day} is in no range)"
)
OFF_GRID = "start must be on the 30-minute grid between 08:00 and 18:00 Africa/Nairobi"
BAD_DURATION = "duration must be 30 or 45 minutes"


def _require_aware(value: datetime, what: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{what} must be an aware datetime")


def to_nairobi(value: datetime) -> str:
    """An aware datetime as an ISO 8601 string in Africa/Nairobi (`+03:00`)."""
    _require_aware(value, "datetime")
    return value.astimezone(NAIROBI).replace(microsecond=0).isoformat()


def valid_slot(
    start: datetime, duration_min: int, availability: Iterable[tuple[date, date]]
) -> str | None:
    """None when the proposal follows every rule, else the reason the API answers with 422."""
    _require_aware(start, "start")
    local = start.astimezone(NAIROBI)
    day = local.date()
    if not any(first <= day <= last for first, last in availability):
        return OUTSIDE_AVAILABILITY.format(day=day.isoformat())
    on_grid = (
        local.second == 0
        and local.microsecond == 0
        and local.minute % GRID_MINUTES == 0
        and FIRST_START <= local.time() <= LAST_START
    )
    if not on_grid:
        return OFF_GRID
    if duration_min not in DURATIONS:
        return BAD_DURATION
    return None
