"""SQLModel tables for the marketplace store (D-17, Sprint 003 spec #35 §Data model).

Every table carries `demo_data` defaulting to true with a CHECK constraint (PRD §3.4: every
prototype record is labelled demo data). Enumerations are text columns with CHECK constraints so
later sprints can add values without an enum migration. Alembic migration 0001 is hand-written to
match these tables; the migration test proves both agree on an empty database.
"""

from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from sqlalchemy import ARRAY, CheckConstraint, Column, DateTime, String, func, true
from sqlmodel import Field, SQLModel

USER_ROLES = ("founder", "builder", "admin")
RECORD_STATUSES = ("pending", "confirmed", "rejected")
CONFIRMATION_KINDS = ("account", "credential", "project")
CONFIRMATION_DECISIONS = ("confirmed", "rejected")


def _now() -> datetime:
    return datetime.now(UTC)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def demo_data_check(table: str) -> CheckConstraint:
    return CheckConstraint("demo_data", name=f"ck_{table}_demo_data")


class DemoRow(SQLModel):
    """Columns every marketplace table shares."""

    created_at: datetime = Field(
        default_factory=_now,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now(), "nullable": False},
    )
    demo_data: bool = Field(default=True, sa_column_kwargs={"server_default": true()})


class UuidRow(DemoRow):
    id: UUID = Field(default_factory=uuid4, primary_key=True)


class User(UuidRow, table=True):
    __tablename__ = "users"
    __table_args__ = (
        demo_data_check("users"),
        CheckConstraint(_in("role", USER_ROLES), name="ck_users_role"),
        CheckConstraint(_in("status", RECORD_STATUSES), name="ck_users_status"),
    )

    clerk_id: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    role: str | None = Field(default=None)
    status: str = Field(default="pending")


class Profile(UuidRow, table=True):
    __tablename__ = "profiles"
    __table_args__ = (
        demo_data_check("profiles"),
        CheckConstraint("day_rate > 0", name="ck_profiles_day_rate"),
        CheckConstraint(
            "supports_remote OR supports_hybrid OR supports_onsite", name="ck_profiles_mode"
        ),
    )

    user_id: UUID = Field(foreign_key="users.id", unique=True)
    builder_id: str = Field(unique=True)
    display_name: str
    headline: str = Field(default="")
    cohort_id: str | None = Field(default=None)
    location: str
    day_rate: int
    supports_remote: bool = Field(default=False)
    supports_hybrid: bool = Field(default=False)
    supports_onsite: bool = Field(default=False)
    self_described_skills: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), nullable=False, server_default="{}"),
    )
    phone: str | None = Field(default=None)
    linkedin: str | None = Field(default=None)
    share_email: bool = Field(default=False)
    share_phone: bool = Field(default=False)
    share_linkedin: bool = Field(default=False)


class Skill(DemoRow, table=True):
    __tablename__ = "skills"
    __table_args__ = (demo_data_check("skills"),)

    id: str = Field(primary_key=True)
    name: str


class Credential(UuidRow, table=True):
    __tablename__ = "credentials"
    __table_args__ = (
        demo_data_check("credentials"),
        CheckConstraint(_in("status", RECORD_STATUSES), name="ck_credentials_status"),
    )

    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    title: str
    issuer: str
    skill_id: str = Field(foreign_key="skills.id")
    status: str = Field(default="pending")


class Project(UuidRow, table=True):
    __tablename__ = "projects"
    __table_args__ = (
        demo_data_check("projects"),
        CheckConstraint(_in("status", RECORD_STATUSES), name="ck_projects_status"),
    )

    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    title: str
    vertical: str
    licensable: bool = Field(default=False)
    completed_on: date
    status: str = Field(default="pending")


class ProjectSkill(DemoRow, table=True):
    __tablename__ = "project_skills"
    __table_args__ = (demo_data_check("project_skills"),)

    project_id: UUID = Field(foreign_key="projects.id", primary_key=True)
    skill_id: str = Field(foreign_key="skills.id", primary_key=True)


class Availability(UuidRow, table=True):
    __tablename__ = "availability"
    __table_args__ = (
        demo_data_check("availability"),
        CheckConstraint("end_date >= start_date", name="ck_availability_order"),
    )

    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    start_date: date
    end_date: date


class Confirmation(UuidRow, table=True):
    """Append-only audit log of admin decisions; the projection reads statuses, never this."""

    __tablename__ = "confirmations"
    __table_args__ = (
        demo_data_check("confirmations"),
        CheckConstraint(_in("kind", CONFIRMATION_KINDS), name="ck_confirmations_kind"),
        CheckConstraint(_in("decision", CONFIRMATION_DECISIONS), name="ck_confirmations_decision"),
    )

    kind: str
    target_id: UUID
    decision: str
    admin_user_id: UUID = Field(foreign_key="users.id")
