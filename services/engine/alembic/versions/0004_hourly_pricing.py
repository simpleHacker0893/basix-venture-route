"""Sprint 007 hourly pricing (D-59, spec 2026-10-02-hourly-pricing-design.md §Data).

Builder rates (#159): `profiles.day_rate` becomes `hourly_rate`, each value
min(50, round_half_up(day_rate / 8)), held between 0 and 50 by `ck_profiles_hourly_rate`. The
migration logs how many rates it capped at 50.

Requests (#160): `requests.daily_budget` becomes `hourly_budget`, round_half_up(budget / 8)
clamped to 1-250 and held there by `ck_requests_hourly_budget`. The stored brief's `dailyBudget`
becomes `hourlyBudget` the same way, and the route snapshot's (D-47) `totalDailyRate` becomes
`totalHourlyRate`, round_half_up(total / 8). Bids (#160): `bids.day_rate` becomes `hourly_rate`,
min(50, round_half_up(day_rate / 8)), held between 0 and 50 by `ck_bids_hourly_rate`. The
migration logs how many requests and bids it converted. Each table converts in its own step.

Downgrade multiplies by 8 and restores the 0003 columns, keys and checks. It loses precision
(demo data, acceptable: a snapshot total of 370 a day returns as 368, a bid capped at 50 returns
as 400); a free (0) rate, which 0003 cannot hold, comes back as 1.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-02
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

HOURS_PER_DAY = 8
MAX_HOURLY_RATE = 50
MIN_HOURLY_BUDGET = 1
MAX_HOURLY_BUDGET = 250


def _hourly(expression: str) -> str:
    """SQL for round_half_up(expression / 8), as numeric."""
    return f"FLOOR(({expression}) / {HOURS_PER_DAY}.0 + 0.5)"


def _budget(expression: str) -> str:
    return f"LEAST({MAX_HOURLY_BUDGET}, GREATEST({MIN_HOURLY_BUDGET}, {_hourly(expression)}))::int"


def _count(statement: str) -> int:
    return int(op.get_bind().execute(text(statement)).scalar_one())


def _profiles_up() -> None:
    capped = (
        op.get_bind()
        .execute(
            text(
                "SELECT count(*) FROM profiles"
                f" WHERE FLOOR(day_rate / {HOURS_PER_DAY}.0 + 0.5) > {MAX_HOURLY_RATE}"
            )
        )
        .scalar_one()
    )
    op.drop_constraint("ck_profiles_day_rate", "profiles", type_="check")
    op.alter_column("profiles", "day_rate", new_column_name="hourly_rate")
    op.execute(
        "UPDATE profiles SET hourly_rate ="
        f" LEAST({MAX_HOURLY_RATE}, FLOOR(hourly_rate / {HOURS_PER_DAY}.0 + 0.5))::int"
    )
    op.create_check_constraint(
        "ck_profiles_hourly_rate",
        "profiles",
        f"hourly_rate >= 0 AND hourly_rate <= {MAX_HOURLY_RATE}",
    )
    # env.py configures no logging handlers, so print keeps the count in the release log.
    print(f"0004_hourly_pricing: capped {capped} builder rate(s) at USD {MAX_HOURLY_RATE} an hour")


def _profiles_down() -> None:
    op.drop_constraint("ck_profiles_hourly_rate", "profiles", type_="check")
    op.alter_column("profiles", "hourly_rate", new_column_name="day_rate")
    op.execute(f"UPDATE profiles SET day_rate = GREATEST(1, day_rate * {HOURS_PER_DAY})")
    op.create_check_constraint("ck_profiles_day_rate", "profiles", "day_rate > 0")


def _requests_up() -> None:
    converted = _count("SELECT count(*) FROM requests")
    op.drop_constraint("ck_requests_daily_budget", "requests", type_="check")
    op.alter_column("requests", "daily_budget", new_column_name="hourly_budget")
    brief_budget = _budget("(brief->>'dailyBudget')::numeric")
    route_total = _hourly("(route->>'totalDailyRate')::numeric")
    op.execute(f"UPDATE requests SET hourly_budget = {_budget('hourly_budget')}")
    op.execute(
        "UPDATE requests SET brief = (brief - 'dailyBudget')"
        f" || jsonb_build_object('hourlyBudget', {brief_budget}) WHERE brief ? 'dailyBudget'"
    )
    op.execute(
        "UPDATE requests SET route = (route - 'totalDailyRate')"
        f" || jsonb_build_object('totalHourlyRate', {route_total}::int)"
        " WHERE route ? 'totalDailyRate'"
    )
    op.create_check_constraint(
        "ck_requests_hourly_budget",
        "requests",
        f"hourly_budget >= {MIN_HOURLY_BUDGET} AND hourly_budget <= {MAX_HOURLY_BUDGET}",
    )
    print(f"0004_hourly_pricing: converted {converted} request(s) to an hourly budget")


def _requests_down() -> None:
    op.drop_constraint("ck_requests_hourly_budget", "requests", type_="check")
    op.alter_column("requests", "hourly_budget", new_column_name="daily_budget")
    op.execute(f"UPDATE requests SET daily_budget = daily_budget * {HOURS_PER_DAY}")
    op.execute(
        "UPDATE requests SET brief = (brief - 'hourlyBudget') || jsonb_build_object("
        f"'dailyBudget', (brief->>'hourlyBudget')::int * {HOURS_PER_DAY})"
        " WHERE brief ? 'hourlyBudget'"
    )
    op.execute(
        "UPDATE requests SET route = (route - 'totalHourlyRate') || jsonb_build_object("
        f"'totalDailyRate', (route->>'totalHourlyRate')::int * {HOURS_PER_DAY})"
        " WHERE route ? 'totalHourlyRate'"
    )
    op.create_check_constraint("ck_requests_daily_budget", "requests", "daily_budget > 0")


def _bids_up() -> None:
    converted = _count("SELECT count(*) FROM bids")
    capped = _count(f"SELECT count(*) FROM bids WHERE {_hourly('day_rate')} > {MAX_HOURLY_RATE}")
    op.drop_constraint("ck_bids_day_rate", "bids", type_="check")
    op.alter_column("bids", "day_rate", new_column_name="hourly_rate")
    op.execute(
        f"UPDATE bids SET hourly_rate = LEAST({MAX_HOURLY_RATE}, {_hourly('hourly_rate')})::int"
    )
    op.create_check_constraint(
        "ck_bids_hourly_rate", "bids", f"hourly_rate >= 0 AND hourly_rate <= {MAX_HOURLY_RATE}"
    )
    print(
        f"0004_hourly_pricing: converted {converted} bid(s) to an hourly rate,"
        f" capped {capped} at USD {MAX_HOURLY_RATE} an hour"
    )


def _bids_down() -> None:
    op.drop_constraint("ck_bids_hourly_rate", "bids", type_="check")
    op.alter_column("bids", "hourly_rate", new_column_name="day_rate")
    op.execute(f"UPDATE bids SET day_rate = GREATEST(1, day_rate * {HOURS_PER_DAY})")
    op.create_check_constraint("ck_bids_day_rate", "bids", "day_rate > 0")


def upgrade() -> None:
    _profiles_up()
    _requests_up()
    _bids_up()


def downgrade() -> None:
    _bids_down()
    _requests_down()
    _profiles_down()
