"""Sprint 007 hourly pricing (D-59, spec 2026-10-02-hourly-pricing-design.md §Data).

Builder rates (#159): `profiles.day_rate` becomes `hourly_rate`, each value
min(50, round_half_up(day_rate / 8)), held between 0 and 50 by `ck_profiles_hourly_rate`. The
migration logs how many rates it capped at 50. Each table converts in its own step so the
requests step (#160) is added beside it.

Downgrade multiplies by 8 and restores the 0003 column and `day_rate > 0` check. It loses
precision (demo data, acceptable); a free (0) rate, which 0003 cannot hold, comes back as 1.

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


def upgrade() -> None:
    _profiles_up()


def downgrade() -> None:
    _profiles_down()
