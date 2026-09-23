"""Marketplace tables: users, profiles, skills, credentials, projects, project_skills,
availability, confirmations. Every table carries demo_data default true with a CHECK (D-17).

Revision ID: 0001
Revises:
Create Date: 2026-09-23
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The nine stable skill ids (CONTEXT.md §Skills) with the display names from seed/facts.metta.
SKILLS = [
    ("python", "Python"),
    ("ai-metta", "AI / MeTTa"),
    ("ui-ux", "UI/UX design"),
    ("frontend", "Frontend"),
    ("backend", "Backend"),
    ("domain-research", "Domain research"),
    ("mobile", "Mobile"),
    ("rust", "Rust"),
    ("data", "Data engineering"),
]

RECORD_STATUSES = "('pending', 'confirmed', 'rejected')"


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


def upgrade() -> None:
    op.create_table(
        "users",
        _uuid_pk(),
        sa.Column("clerk_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
        *_demo_columns("users"),
        sa.CheckConstraint("role IN ('founder', 'builder', 'admin')", name="ck_users_role"),
        sa.CheckConstraint(f"status IN {RECORD_STATUSES}", name="ck_users_status"),
        sa.UniqueConstraint("clerk_id", name="uq_users_clerk_id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_clerk_id", "users", ["clerk_id"])

    op.create_table(
        "profiles",
        _uuid_pk(),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("builder_id", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("headline", sa.String(), server_default="", nullable=False),
        sa.Column("cohort_id", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("day_rate", sa.Integer(), nullable=False),
        sa.Column("supports_remote", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("supports_hybrid", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("supports_onsite", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "self_described_skills",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("linkedin", sa.String(), nullable=True),
        sa.Column("share_email", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("share_phone", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("share_linkedin", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_demo_columns("profiles"),
        sa.CheckConstraint("day_rate > 0", name="ck_profiles_day_rate"),
        sa.CheckConstraint(
            "supports_remote OR supports_hybrid OR supports_onsite", name="ck_profiles_mode"
        ),
        sa.UniqueConstraint("user_id", name="uq_profiles_user_id"),
        sa.UniqueConstraint("builder_id", name="uq_profiles_builder_id"),
    )

    skills = op.create_table(
        "skills",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        *_demo_columns("skills"),
    )
    op.bulk_insert(skills, [{"id": skill_id, "name": name} for skill_id, name in SKILLS])

    op.create_table(
        "credentials",
        _uuid_pk(),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("issuer", sa.String(), nullable=False),
        sa.Column("skill_id", sa.String(), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
        *_demo_columns("credentials"),
        sa.CheckConstraint(f"status IN {RECORD_STATUSES}", name="ck_credentials_status"),
    )
    op.create_index("ix_credentials_profile_id", "credentials", ["profile_id"])

    op.create_table(
        "projects",
        _uuid_pk(),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("vertical", sa.String(), nullable=False),
        sa.Column("licensable", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("completed_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
        *_demo_columns("projects"),
        sa.CheckConstraint(f"status IN {RECORD_STATUSES}", name="ck_projects_status"),
    )
    op.create_index("ix_projects_profile_id", "projects", ["profile_id"])

    op.create_table(
        "project_skills",
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id"),
            primary_key=True,
        ),
        sa.Column("skill_id", sa.String(), sa.ForeignKey("skills.id"), primary_key=True),
        *_demo_columns("project_skills"),
    )

    op.create_table(
        "availability",
        _uuid_pk(),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        *_demo_columns("availability"),
        sa.CheckConstraint("end_date >= start_date", name="ck_availability_order"),
    )
    op.create_index("ix_availability_profile_id", "availability", ["profile_id"])

    op.create_table(
        "confirmations",
        _uuid_pk(),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("decision", sa.String(), nullable=False),
        sa.Column(
            "admin_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        *_demo_columns("confirmations"),
        sa.CheckConstraint(
            "kind IN ('account', 'credential', 'project')", name="ck_confirmations_kind"
        ),
        sa.CheckConstraint(
            "decision IN ('confirmed', 'rejected')", name="ck_confirmations_decision"
        ),
    )


def downgrade() -> None:
    for table in (
        "confirmations",
        "availability",
        "project_skills",
        "projects",
        "credentials",
        "skills",
        "profiles",
        "users",
    ):
        op.drop_table(table)
