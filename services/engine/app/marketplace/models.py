"""SQLModel tables for the marketplace store (D-17, Sprint 003 spec #35 §Data model).

Every table carries `demo_data` defaulting to true with a CHECK constraint (PRD §3.4: every
prototype record is labelled demo data). Enumerations are text columns with CHECK constraints so
later sprints can add values without an enum migration. Alembic migration 0001 is hand-written to
match these tables; the migration test proves both agree on an empty database.
"""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Column,
    DateTime,
    Index,
    String,
    UniqueConstraint,
    false,
    func,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

USER_ROLES = ("founder", "builder", "admin")
RECORD_STATUSES = ("pending", "confirmed", "rejected")
CONFIRMATION_KINDS = ("account", "credential", "project", "showcase")
CONFIRMATION_DECISIONS = ("confirmed", "rejected")
# Sprint 004 (spec #52 §Store): requests, bids, bookings.
REQUEST_STATUSES = ("open", "closed")
ROUTE_STATUSES = ("feasible", "partial", "infeasible")
BID_STATUSES = ("submitted",)
BOOKING_STATES = ("proposed", "accepted", "countered", "confirmed")
BOOKING_DURATIONS = (30, 45)
BID_MESSAGE_MAX = 1000
BOOKING_NOTE_MAX = 500
# Sprint 005a (spec #86 §Store, #88): the Showcase, the skill set, profile links, certifications.
SHOWCASE_STATUSES = ("none", "pending", "confirmed", "rejected")
PROJECT_DESCRIPTION_MAX = 1000
LINK_MAX = 500


def _now() -> datetime:
    return datetime.now(UTC)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def demo_data_check(table: str) -> CheckConstraint:
    return CheckConstraint("demo_data", name=f"ck_{table}_demo_data")


def link_check(table: str, column: str) -> CheckConstraint:
    return CheckConstraint(
        f"char_length({column}) <= {LINK_MAX}", name=f"ck_{table}_{column}_length"
    )


def text_array() -> Column[list[str]]:
    return Column(ARRAY(String), nullable=False, server_default="{}")


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
        link_check("profiles", "github_url"),
        link_check("profiles", "linkedin_url"),
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
    self_described_skills: list[str] = Field(default_factory=list, sa_column=text_array())
    phone: str | None = Field(default=None)
    linkedin: str | None = Field(default=None)
    share_email: bool = Field(default=False)
    share_phone: bool = Field(default=False)
    share_linkedin: bool = Field(default=False)
    # Sprint 005a (#88): display-only skill labels and links; `suggested_skills` is its own
    # column, apart from `skill_set` (Operator ruling 2026-09-24, amends spec #86).
    skill_set: list[str] = Field(default_factory=list, sa_column=text_array())
    suggested_skills: list[str] = Field(default_factory=list, sa_column=text_array())
    github_url: str | None = Field(default=None)
    linkedin_url: str | None = Field(default=None)


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
        link_check("credentials", "credential_url"),
    )

    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    title: str
    issuer: str
    # NULL since 0003 (#88): a certification that proves no graph skill.
    skill_id: str | None = Field(default=None, foreign_key="skills.id")
    status: str = Field(default="pending")
    issued_on: date | None = Field(default=None)
    credential_url: str | None = Field(default=None)


class Project(UuidRow, table=True):
    __tablename__ = "projects"
    __table_args__ = (
        demo_data_check("projects"),
        CheckConstraint(_in("status", RECORD_STATUSES), name="ck_projects_status"),
        CheckConstraint(
            f"char_length(description) <= {PROJECT_DESCRIPTION_MAX}",
            name="ck_projects_description_length",
        ),
        link_check("projects", "live_url"),
        link_check("projects", "demo_url"),
        link_check("projects", "pitch_video_url"),
        link_check("projects", "pitch_deck_url"),
        CheckConstraint(
            _in("showcase_status", SHOWCASE_STATUSES), name="ck_projects_showcase_status"
        ),
        Index(
            "ix_projects_showcase_status_confirmed_at",
            "showcase_status",
            text("showcase_confirmed_at DESC"),
        ),
    )

    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    title: str
    vertical: str
    licensable: bool = Field(default=False)
    completed_on: date
    status: str = Field(default="pending")
    # Sprint 005a (#88): the Showcase entry. Visible only when showcased, showcase_status is
    # confirmed, the project is confirmed and the owner's account is confirmed.
    description: str = Field(default="", sa_column_kwargs={"server_default": ""})
    live_url: str | None = Field(default=None)
    demo_url: str | None = Field(default=None)
    pitch_video_url: str | None = Field(default=None)
    pitch_deck_url: str | None = Field(default=None)
    showcased: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    showcase_status: str = Field(default="none", sa_column_kwargs={"server_default": "none"})
    showcase_confirmed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


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


# -- Sprint 004 (spec #52 §Store, #53): requests, bids, bookings ----------------------------------
# None of these rows ever becomes an atom; the projection reads profile rows only (D-15).


class Request(UuidRow, table=True):
    """A founder's published brief: the VentureBrief snapshot the engine routed, its promoted
    columns for listing and filtering, and the route snapshot the founder saw when publishing.
    The snapshot is display-only; eligibility is always recomputed by the engine."""

    __tablename__ = "requests"
    __table_args__ = (
        demo_data_check("requests"),
        CheckConstraint("availability_end >= availability_start", name="ck_requests_window"),
        CheckConstraint("daily_budget > 0", name="ck_requests_daily_budget"),
        CheckConstraint(_in("route_status", ROUTE_STATUSES), name="ck_requests_route_status"),
        CheckConstraint(_in("status", REQUEST_STATUSES), name="ck_requests_status"),
        Index("ix_requests_status_created_at", "status", "created_at"),
    )

    founder_id: UUID = Field(foreign_key="users.id", index=True)
    brief: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    title: str
    vertical: str
    delivery_mode: str
    availability_start: date
    availability_end: date
    daily_budget: int
    route: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    route_status: str
    status: str = Field(default="open", sa_column_kwargs={"server_default": "open"})
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class Bid(UuidRow, table=True):
    """One bid per builder per request (UNIQUE), stored with the skills and the reasoning path
    the engine returned when `eligible-builder` held."""

    __tablename__ = "bids"
    __table_args__ = (
        demo_data_check("bids"),
        CheckConstraint("day_rate > 0", name="ck_bids_day_rate"),
        CheckConstraint(
            f"char_length(message) <= {BID_MESSAGE_MAX}", name="ck_bids_message_length"
        ),
        CheckConstraint(_in("status", BID_STATUSES), name="ck_bids_status"),
        UniqueConstraint("request_id", "profile_id", name="uq_bids_request_profile"),
    )

    request_id: UUID = Field(foreign_key="requests.id", index=True)
    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    day_rate: int
    message: str = Field(default="", sa_column_kwargs={"server_default": ""})
    eligible_skills: list[str] = Field(sa_column=Column(JSONB, nullable=False))
    path: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    status: str = Field(default="submitted", sa_column_kwargs={"server_default": "submitted"})


class Booking(UuidRow, table=True):
    """An interview proposal between a founder and a confirmed builder. `proposed_start` is the
    current proposal in UTC (D-16); `history` is the JSONB list of every transition, written in
    the same UPDATE as `state` so the two never disagree."""

    __tablename__ = "bookings"
    __table_args__ = (
        demo_data_check("bookings"),
        CheckConstraint(
            f"duration_min IN ({', '.join(str(d) for d in BOOKING_DURATIONS)})",
            name="ck_bookings_duration",
        ),
        CheckConstraint(_in("state", BOOKING_STATES), name="ck_bookings_state"),
        CheckConstraint(f"char_length(note) <= {BOOKING_NOTE_MAX}", name="ck_bookings_note_length"),
    )

    request_id: UUID | None = Field(default=None, foreign_key="requests.id")
    founder_id: UUID = Field(foreign_key="users.id", index=True)
    profile_id: UUID = Field(foreign_key="profiles.id", index=True)
    proposed_start: datetime = Field(sa_type=DateTime(timezone=True))
    duration_min: int
    state: str = Field(default="proposed", sa_column_kwargs={"server_default": "proposed"})
    history: list[dict[str, Any]] = Field(sa_column=Column(JSONB, nullable=False))
    note: str = Field(default="", sa_column_kwargs={"server_default": ""})
