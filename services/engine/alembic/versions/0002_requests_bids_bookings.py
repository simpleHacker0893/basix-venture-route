"""Sprint 004 tables: requests, bids, bookings. Every table carries demo_data default true with a
CHECK (D-17); enumerations are text columns with CHECK constraints, as in 0001 (spec #52 §Store).

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-23
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _demo_columns(table: str) -> list[sa.Column[Any] | sa.CheckConstraint]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("demo_data", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.CheckConstraint("demo_data", name=f"ck_{table}_demo_data"),
    ]


def _uuid_pk() -> sa.Column[Any]:
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True)


def _fk(name: str, target: str, *, nullable: bool = False) -> sa.Column[Any]:
    return sa.Column(name, postgresql.UUID(as_uuid=True), sa.ForeignKey(target), nullable=nullable)


def upgrade() -> None:
    op.create_table(
        "requests",
        _uuid_pk(),
        _fk("founder_id", "users.id"),
        sa.Column("brief", postgresql.JSONB(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("vertical", sa.String(), nullable=False),
        sa.Column("delivery_mode", sa.String(), nullable=False),
        sa.Column("availability_start", sa.Date(), nullable=False),
        sa.Column("availability_end", sa.Date(), nullable=False),
        sa.Column("daily_budget", sa.Integer(), nullable=False),
        sa.Column("route", postgresql.JSONB(), nullable=False),
        sa.Column("route_status", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="open", nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        *_demo_columns("requests"),
        sa.CheckConstraint("availability_end >= availability_start", name="ck_requests_window"),
        sa.CheckConstraint("daily_budget > 0", name="ck_requests_daily_budget"),
        sa.CheckConstraint(
            "route_status IN ('feasible', 'partial', 'infeasible')",
            name="ck_requests_route_status",
        ),
        sa.CheckConstraint("status IN ('open', 'closed')", name="ck_requests_status"),
    )
    op.create_index("ix_requests_founder_id", "requests", ["founder_id"])
    op.create_index("ix_requests_status_created_at", "requests", ["status", "created_at"])

    op.create_table(
        "bids",
        _uuid_pk(),
        _fk("request_id", "requests.id"),
        _fk("profile_id", "profiles.id"),
        sa.Column("day_rate", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(), server_default="", nullable=False),
        sa.Column("eligible_skills", postgresql.JSONB(), nullable=False),
        sa.Column("path", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(), server_default="submitted", nullable=False),
        *_demo_columns("bids"),
        sa.CheckConstraint("day_rate > 0", name="ck_bids_day_rate"),
        sa.CheckConstraint("char_length(message) <= 1000", name="ck_bids_message_length"),
        sa.CheckConstraint("status IN ('submitted')", name="ck_bids_status"),
        sa.UniqueConstraint("request_id", "profile_id", name="uq_bids_request_profile"),
    )
    op.create_index("ix_bids_request_id", "bids", ["request_id"])
    op.create_index("ix_bids_profile_id", "bids", ["profile_id"])

    op.create_table(
        "bookings",
        _uuid_pk(),
        _fk("request_id", "requests.id", nullable=True),
        _fk("founder_id", "users.id"),
        _fk("profile_id", "profiles.id"),
        sa.Column("proposed_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(), server_default="proposed", nullable=False),
        sa.Column("history", postgresql.JSONB(), nullable=False),
        sa.Column("note", sa.String(), server_default="", nullable=False),
        *_demo_columns("bookings"),
        sa.CheckConstraint("duration_min IN (30, 45)", name="ck_bookings_duration"),
        sa.CheckConstraint(
            "state IN ('proposed', 'accepted', 'countered', 'confirmed')",
            name="ck_bookings_state",
        ),
        sa.CheckConstraint("char_length(note) <= 500", name="ck_bookings_note_length"),
    )
    op.create_index("ix_bookings_founder_id", "bookings", ["founder_id"])
    op.create_index("ix_bookings_profile_id", "bookings", ["profile_id"])


def downgrade() -> None:
    for table in ("bookings", "bids", "requests"):
        op.drop_table(table)
