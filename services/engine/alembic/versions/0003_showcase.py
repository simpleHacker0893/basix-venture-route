"""Sprint 005a Showcase store (spec #86, #88): showcase fields on projects, the skill set and the
profile links on profiles, skill-less certifications on credentials, `showcase` confirmations.

Every new column is nullable or carries a server default, so rows written under 0002 keep their
values. Enumerations stay text columns with CHECK constraints, as in 0001 and 0002.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LINK_MAX = 500
PROJECT_LINKS = ("live_url", "demo_url", "pitch_video_url", "pitch_deck_url")
PROFILE_LINKS = ("github_url", "linkedin_url")
KINDS_0002 = "('account', 'credential', 'project')"
KINDS_0003 = "('account', 'credential', 'project', 'showcase')"


def _link_check(table: str, column: str) -> None:
    op.create_check_constraint(
        f"ck_{table}_{column}_length", table, f"char_length({column}) <= {LINK_MAX}"
    )


def upgrade() -> None:
    op.add_column(
        "projects", sa.Column("description", sa.String(), server_default="", nullable=False)
    )
    for column in PROJECT_LINKS:
        op.add_column("projects", sa.Column(column, sa.String(), nullable=True))
        _link_check("projects", column)
    op.add_column(
        "projects", sa.Column("showcased", sa.Boolean(), server_default=sa.false(), nullable=False)
    )
    op.add_column(
        "projects",
        sa.Column("showcase_status", sa.String(), server_default="none", nullable=False),
    )
    op.add_column(
        "projects",
        sa.Column("showcase_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_projects_description_length", "projects", "char_length(description) <= 1000"
    )
    op.create_check_constraint(
        "ck_projects_showcase_status",
        "projects",
        "showcase_status IN ('none', 'pending', 'confirmed', 'rejected')",
    )
    op.create_index(
        "ix_projects_showcase_status_confirmed_at",
        "projects",
        ["showcase_status", sa.text("showcase_confirmed_at DESC")],
    )

    for column in ("skill_set", "suggested_skills"):
        op.add_column(
            "profiles",
            sa.Column(column, postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
        )
    for column in PROFILE_LINKS:
        op.add_column("profiles", sa.Column(column, sa.String(), nullable=True))
        _link_check("profiles", column)

    op.alter_column("credentials", "skill_id", existing_type=sa.String(), nullable=True)
    op.add_column("credentials", sa.Column("issued_on", sa.Date(), nullable=True))
    op.add_column("credentials", sa.Column("credential_url", sa.String(), nullable=True))
    _link_check("credentials", "credential_url")

    op.drop_constraint("ck_confirmations_kind", "confirmations", type_="check")
    op.create_check_constraint("ck_confirmations_kind", "confirmations", f"kind IN {KINDS_0003}")


def downgrade() -> None:
    # Rows 0002 cannot represent are removed first: showcase decisions and skill-less
    # certifications. Every other row keeps its 0002 columns; the 0003 columns are dropped.
    op.execute("DELETE FROM confirmations WHERE kind = 'showcase'")
    op.drop_constraint("ck_confirmations_kind", "confirmations", type_="check")
    op.create_check_constraint("ck_confirmations_kind", "confirmations", f"kind IN {KINDS_0002}")

    op.drop_column("credentials", "credential_url")
    op.drop_column("credentials", "issued_on")
    op.execute("DELETE FROM credentials WHERE skill_id IS NULL")
    op.alter_column("credentials", "skill_id", existing_type=sa.String(), nullable=False)

    for column in (*PROFILE_LINKS, "suggested_skills", "skill_set"):
        op.drop_column("profiles", column)

    op.drop_index("ix_projects_showcase_status_confirmed_at", table_name="projects")
    for column in (
        "showcase_confirmed_at",
        "showcase_status",
        "showcased",
        *PROJECT_LINKS,
        "description",
    ):
        op.drop_column("projects", column)
