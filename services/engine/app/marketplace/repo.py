"""Every marketplace query the API and the projection use (spec #35 §Architecture).

Routes and the projection never write SQL themselves; they call these functions with a session.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import Select

from app.marketplace.models import (
    ROUTE_STATUSES,
    Availability,
    Bid,
    Booking,
    Confirmation,
    Credential,
    Profile,
    Project,
    ProjectSkill,
    Request,
    Skill,
    User,
)
from app.marketplace.verification import (
    ConfirmedBuilder,
    ConfirmedCredential,
    ConfirmedProject,
    ConfirmedRows,
)

_NON_SLUG = re.compile(r"[^a-z0-9]+")

# Symbols the seed vocabulary already uses in the one untyped atom namespace a builder slug
# joins (modes, verticals, evidence types, the admin symbol). Skill ids come from the skills
# table and seed entities and locations from the engine; a slug never equals any of them.
RESERVED_SYMBOLS = frozenset(
    {
        "remote",
        "hybrid",
        "on-site",
        "health",
        "agri",
        "education",
        "credential",
        "project",
        "both",
        "admin-basix",
        "builder",
    }
)


# -- users ----------------------------------------


async def user_by_clerk_id(session: AsyncSession, clerk_id: str) -> User | None:
    return (await session.exec(select(User).where(User.clerk_id == clerk_id))).first()


# -- skills ----------------------------------------


async def skill_names(session: AsyncSession) -> dict[str, str]:
    """Skill id → display name, in the seed order the migration inserted them."""
    rows = (await session.exec(select(Skill).order_by(col(Skill.created_at), col(Skill.id)))).all()
    return {row.id: row.name for row in rows}


# -- profiles ----------------------------------------


async def profile_for_user(session: AsyncSession, user_id: UUID) -> Profile | None:
    return (await session.exec(select(Profile).where(Profile.user_id == user_id))).first()


async def confirmed_profile_by_builder_id(
    session: AsyncSession, builder_id: str
) -> tuple[Profile, User] | None:
    """The profile and account behind a builder slug, only once an admin confirmed the account
    (DOMAIN.md §Marketplace rules); seed builder ids have no row and answer None too."""
    statement = (
        select(Profile, User)
        .join(User, col(User.id) == col(Profile.user_id))
        .where(Profile.builder_id == builder_id, User.status == "confirmed")
    )
    row = (await session.exec(statement)).first()
    return None if row is None else (row[0], row[1])


async def profile_by_builder_id(session: AsyncSession, builder_id: str) -> Profile | None:
    return (await session.exec(select(Profile).where(Profile.builder_id == builder_id))).first()


def slugify(display_name: str) -> str:
    slug = _NON_SLUG.sub("-", display_name.lower()).strip("-")
    return slug or "builder"


def builder_slug(display_name: str) -> str:
    """A slug MeTTa reads as a symbol: a leading digit would parse as a number, so such names
    get a `b-` prefix (`2026` → `b-2026`)."""
    slug = slugify(display_name)
    return slug if slug[0].isalpha() else f"b-{slug}"


async def allocate_builder_id(
    session: AsyncSession, display_name: str, reserved: Iterable[str]
) -> str:
    """The graph id for a user-entered builder (D-24): the display-name slug, suffixed `-2`,
    `-3`, ... when a profile, a seed entity, a location or a fixed vocabulary symbol already
    holds it. Assigned once, never changed."""
    base = builder_slug(display_name)
    taken = set(reserved) | RESERVED_SYMBOLS | set(await skill_names(session))
    taken.update(
        (
            await session.exec(
                select(Profile.builder_id).where(col(Profile.builder_id).startswith(base))
            )
        ).all()
    )
    if base not in taken:
        return base
    suffix = 2
    while f"{base}-{suffix}" in taken:
        suffix += 1
    return f"{base}-{suffix}"


async def availability_for(session: AsyncSession, profile_id: UUID) -> list[Availability]:
    statement = (
        select(Availability)
        .where(Availability.profile_id == profile_id)
        .order_by(col(Availability.start_date), col(Availability.end_date))
    )
    return list((await session.exec(statement)).all())


async def replace_availability(
    session: AsyncSession, profile_id: UUID, ranges: Iterable[tuple[date, date]]
) -> None:
    for row in await availability_for(session, profile_id):
        await session.delete(row)
    for start, end in ranges:
        session.add(Availability(profile_id=profile_id, start_date=start, end_date=end))


# -- confirmed rows: the one input verification and projection share ------------------------------


async def confirmed_rows_for(session: AsyncSession, profile_id: UUID) -> ConfirmedRows:
    credentials = (
        await session.exec(
            select(Credential)
            .where(Credential.profile_id == profile_id, Credential.status == "confirmed")
            .order_by(col(Credential.created_at))
        )
    ).all()
    projects = (
        await session.exec(
            select(Project)
            .where(Project.profile_id == profile_id, Project.status == "confirmed")
            .order_by(col(Project.created_at))
        )
    ).all()
    project_ids = [project.id for project in projects]
    links: list[ProjectSkill] = []
    if project_ids:
        links = list(
            (
                await session.exec(
                    select(ProjectSkill).where(col(ProjectSkill.project_id).in_(project_ids))
                )
            ).all()
        )
    skills_by_project: dict[UUID, list[str]] = {}
    for link in links:
        skills_by_project.setdefault(link.project_id, []).append(link.skill_id)
    return ConfirmedRows(
        credentials=tuple(
            ConfirmedCredential(credential_id=str(row.id), skill_id=row.skill_id)
            for row in credentials
        ),
        projects=tuple(
            ConfirmedProject(
                project_id=str(row.id),
                skill_ids=tuple(sorted(skills_by_project.get(row.id, []))),
                licensable=row.licensable,
                vertical=row.vertical,
            )
            for row in projects
        ),
    )


# -- proof rows a builder owns ------------------------------------------------


async def credentials_for(session: AsyncSession, profile_id: UUID) -> list[Credential]:
    statement = (
        select(Credential)
        .where(Credential.profile_id == profile_id)
        .order_by(col(Credential.created_at), col(Credential.id))
    )
    return list((await session.exec(statement)).all())


async def projects_for(session: AsyncSession, profile_id: UUID) -> list[tuple[Project, list[str]]]:
    """Each project with its demonstrated skill ids, in seed skill order."""
    statement = (
        select(Project)
        .where(Project.profile_id == profile_id)
        .order_by(col(Project.created_at), col(Project.id))
    )
    projects = list((await session.exec(statement)).all())
    if not projects:
        return []
    links = (
        await session.exec(
            select(ProjectSkill).where(col(ProjectSkill.project_id).in_([p.id for p in projects]))
        )
    ).all()
    order = {skill: index for index, skill in enumerate(await skill_names(session))}
    by_project: dict[UUID, list[str]] = {}
    for link in links:
        by_project.setdefault(link.project_id, []).append(link.skill_id)
    return [
        (project, sorted(by_project.get(project.id, []), key=lambda s: order.get(s, 99)))
        for project in projects
    ]


async def add_credential(
    session: AsyncSession, profile_id: UUID, *, title: str, issuer: str, skill_id: str
) -> Credential:
    row = Credential(profile_id=profile_id, title=title, issuer=issuer, skill_id=skill_id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def add_project(
    session: AsyncSession,
    profile_id: UUID,
    *,
    title: str,
    vertical: str,
    licensable: bool,
    completed_on: date,
    skill_ids: Iterable[str],
) -> Project:
    row = Project(
        profile_id=profile_id,
        title=title,
        vertical=vertical,
        licensable=licensable,
        completed_on=completed_on,
    )
    session.add(row)
    await session.flush()
    for skill_id in dict.fromkeys(skill_ids):
        session.add(ProjectSkill(project_id=row.id, skill_id=skill_id))
    await session.commit()
    await session.refresh(row)
    return row


# -- projection input: every builder whose account is confirmed ---------------


async def confirmed_builders(session: AsyncSession) -> list[ConfirmedBuilder]:
    statement = (
        select(Profile, User)
        .join(User, col(User.id) == col(Profile.user_id))
        .where(User.status == "confirmed", User.role == "builder")
        .order_by(col(Profile.builder_id))
    )
    out: list[ConfirmedBuilder] = []
    for profile, _user in (await session.exec(statement)).all():
        modes = tuple(
            mode
            for mode, on in (
                ("remote", profile.supports_remote),
                ("hybrid", profile.supports_hybrid),
                ("on-site", profile.supports_onsite),
            )
            if on
        )
        availability = tuple(
            (row.start_date, row.end_date) for row in await availability_for(session, profile.id)
        )
        out.append(
            ConfirmedBuilder(
                builder_id=profile.builder_id,
                day_rate=profile.day_rate,
                location=profile.location,
                modes=modes,
                availability=availability,
                cohort_id=profile.cohort_id,
                self_described=tuple(profile.self_described_skills),
                rows=await confirmed_rows_for(session, profile.id),
            )
        )
    return out


# -- admin queue ----------------------------------------------------------------


async def pending_accounts(session: AsyncSession) -> list[tuple[User, Profile | None]]:
    statement = (
        select(User)
        # Admins are bootstrapped confirmed (D-03) and never queue; founders and builders do.
        .where(User.status == "pending", col(User.role).in_(["founder", "builder"]))
        .order_by(col(User.created_at), col(User.id))
    )
    users = (await session.exec(statement)).all()
    return [(user, await profile_for_user(session, user.id)) for user in users]


async def pending_credentials(session: AsyncSession) -> list[tuple[Credential, Profile]]:
    statement = (
        select(Credential, Profile)
        .join(Profile, col(Profile.id) == col(Credential.profile_id))
        .where(Credential.status == "pending")
        .order_by(col(Credential.created_at), col(Credential.id))
    )
    return [(row, profile) for row, profile in (await session.exec(statement)).all()]


async def pending_projects(session: AsyncSession) -> list[tuple[Project, Profile, list[str]]]:
    statement = (
        select(Project, Profile)
        .join(Profile, col(Profile.id) == col(Project.profile_id))
        .where(Project.status == "pending")
        .order_by(col(Project.created_at), col(Project.id))
    )
    pairs = (await session.exec(statement)).all()
    out: list[tuple[Project, Profile, list[str]]] = []
    for row, profile in pairs:
        skills = [s for p, s in await projects_for(session, profile.id) if p.id == row.id]
        out.append((row, profile, skills[0] if skills else []))
    return out


async def decide(
    session: AsyncSession,
    kind: str,
    target_id: UUID,
    decision: str,
    admin_user_id: UUID,
) -> bool:
    """Set the target's status, log the decision, commit. False when the target is unknown.
    Any transition is allowed so an admin can reverse a mistake; the log keeps every step."""
    target: User | Credential | Project | None
    if kind == "account":
        target = await session.get(User, target_id)
    elif kind == "credential":
        target = await session.get(Credential, target_id)
    else:
        target = await session.get(Project, target_id)
    if target is None:
        return False
    target.status = decision
    session.add(
        Confirmation(kind=kind, target_id=target_id, decision=decision, admin_user_id=admin_user_id)
    )
    await session.commit()
    return True


# -- requests (Sprint 004, spec #52 §Store, #59) --------------------------------------------------
# A request is a founder's published brief. Rows never become atoms (D-15).


async def create_request(
    session: AsyncSession,
    founder: User,
    *,
    brief: dict[str, Any],
    route: dict[str, Any],
    title: str,
    vertical: str,
    delivery_mode: str,
    availability_start: date,
    availability_end: date,
    daily_budget: int,
    route_status: str,
) -> Request:
    row = Request(
        founder_id=founder.id,
        brief=brief,
        route=route,
        title=title,
        vertical=vertical,
        delivery_mode=delivery_mode,
        availability_start=availability_start,
        availability_end=availability_end,
        daily_budget=daily_budget,
        route_status=route_status,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def _requests_newest_first() -> Select[tuple[Request, User]]:
    return (
        select(Request, User)
        .join(User, col(User.id) == col(Request.founder_id))
        .order_by(col(Request.created_at).desc(), col(Request.id))
    )


async def requests_for_founder(
    session: AsyncSession, founder_id: UUID
) -> list[tuple[Request, User]]:
    """The founder's own requests in every status, newest first."""
    statement = _requests_newest_first().where(Request.founder_id == founder_id)
    return [(row, user) for row, user in (await session.exec(statement)).all()]


async def open_requests(session: AsyncSession) -> list[tuple[Request, User]]:
    """Every open request, newest first: what a builder's board lists."""
    statement = _requests_newest_first().where(Request.status == "open")
    return [(row, user) for row, user in (await session.exec(statement)).all()]


async def request_by_id(session: AsyncSession, request_id: UUID) -> tuple[Request, User] | None:
    statement = _requests_newest_first().where(Request.id == request_id)
    found = (await session.exec(statement)).first()
    return None if found is None else (found[0], found[1])


async def close_request(session: AsyncSession, row: Request, now: datetime) -> Request:
    """Status `closed` with `closed_at`, committed. The caller checks it was open."""
    row.status = "closed"
    row.closed_at = now
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def request_for_update(session: AsyncSession, request_id: UUID) -> Request | None:
    """The request row locked FOR UPDATE, so a bid's open check and insert see one status."""
    statement = select(Request).where(Request.id == request_id).with_for_update()
    return (await session.exec(statement)).first()


# -- bids (spec #52 §Store, #62) ------------------------------------------------------------------


async def add_bid(
    session: AsyncSession,
    request: Request,
    profile: Profile,
    *,
    day_rate: int,
    message: str,
    eligible_skills: Sequence[str],
    path: dict[str, Any],
) -> Bid | None:
    """Insert and commit one bid; None when the (request, profile) UNIQUE already holds, so a
    race between two identical bids still ends in one row (the caller answers 409)."""
    row = Bid(
        request_id=request.id,
        profile_id=profile.id,
        day_rate=day_rate,
        message=message,
        eligible_skills=list(eligible_skills),
        path=path,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        return None
    await session.refresh(row)
    return row


async def bids_for_request(session: AsyncSession, request: Request) -> list[tuple[Bid, Profile]]:
    """The request's bids from builders whose account is confirmed right now, newest first. A
    bid from a builder who was un-confirmed since is hidden, never deleted."""
    statement = (
        select(Bid, Profile)
        .join(Profile, col(Profile.id) == col(Bid.profile_id))
        .join(User, col(User.id) == col(Profile.user_id))
        .where(Bid.request_id == request.id, User.status == "confirmed")
        .order_by(col(Bid.created_at).desc(), col(Bid.id))
    )
    return [(row, profile) for row, profile in (await session.exec(statement)).all()]


# -- bookings (spec #52 §Store, #64) --------------------------------------------------------------

BookingRow = tuple[Booking, Profile, User, Request | None]


def _bookings_upcoming_first() -> Select[tuple[Booking, Profile, User, Request]]:
    """Soonest proposed start first. The request join is an OUTER join: the fourth column is
    None for a booking made from a candidate profile (SQLAlchemy types it as non-null)."""
    return (
        select(Booking, Profile, User, Request)
        .join(Profile, col(Profile.id) == col(Booking.profile_id))
        .join(User, col(User.id) == col(Booking.founder_id))
        .outerjoin(Request, col(Request.id) == col(Booking.request_id))
        .order_by(col(Booking.proposed_start), col(Booking.created_at), col(Booking.id))
    )


async def add_booking(
    session: AsyncSession,
    founder: User,
    profile: Profile,
    request: Request | None,
    *,
    proposed_start: datetime,
    duration_min: int,
    note: str,
    state: str,
    history: list[dict[str, Any]],
) -> Booking:
    """Insert the founder's proposal with its first history entry, committed."""
    row = Booking(
        request_id=None if request is None else request.id,
        founder_id=founder.id,
        profile_id=profile.id,
        proposed_start=proposed_start,
        duration_min=duration_min,
        state=state,
        history=history,
        note=note,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def booking_for_update(session: AsyncSession, booking_id: UUID) -> Booking | None:
    """The booking row locked FOR UPDATE, so a transition reads and writes one state."""
    statement = select(Booking).where(Booking.id == booking_id).with_for_update()
    return (await session.exec(statement)).first()


async def apply_transition(
    session: AsyncSession,
    row: Booking,
    *,
    state: str,
    history: list[dict[str, Any]],
    proposed_start: datetime,
    duration_min: int,
    note: str,
) -> Booking:
    """State, history, proposed start, duration and note in one UPDATE, committed together, so
    the row's state and its history can never disagree (spec #52 §Transaction shape)."""
    row.state = state
    row.history = history
    row.proposed_start = proposed_start
    row.duration_min = duration_min
    row.note = note
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def booking_by_id(session: AsyncSession, booking_id: UUID) -> BookingRow | None:
    statement = _bookings_upcoming_first().where(Booking.id == booking_id)
    found = (await session.exec(statement)).first()
    return None if found is None else (found[0], found[1], found[2], found[3])


async def bookings_for_founder(session: AsyncSession, founder_id: UUID) -> list[BookingRow]:
    statement = _bookings_upcoming_first().where(Booking.founder_id == founder_id)
    return [(b, p, u, r) for b, p, u, r in (await session.exec(statement)).all()]


async def bookings_for_profile(session: AsyncSession, profile_id: UUID) -> list[BookingRow]:
    statement = _bookings_upcoming_first().where(Booking.profile_id == profile_id)
    return [(b, p, u, r) for b, p, u, r in (await session.exec(statement)).all()]


# -- dashboard (spec #52 §Dashboard response, #66): counts from SQL, never from the engine ------


async def dashboard_counts(session: AsyncSession, founder_id: UUID) -> dict[str, Any]:
    """`briefs` counts the founder's requests, `routes` groups them by route_status,
    `openRequests`, `bidsReceived` (bids on the founder's requests from confirmed builders) and
    `bookings` (the founder's bookings in every state)."""
    briefs = (
        await session.exec(
            select(func.count()).select_from(Request).where(Request.founder_id == founder_id)
        )
    ).one()
    by_status = dict(
        (
            await session.exec(
                select(Request.route_status, func.count())
                .where(Request.founder_id == founder_id)
                .group_by(Request.route_status)
            )
        ).all()
    )
    open_requests = (
        await session.exec(
            select(func.count())
            .select_from(Request)
            .where(Request.founder_id == founder_id, Request.status == "open")
        )
    ).one()
    bids_received = (
        await session.exec(
            select(func.count())
            .select_from(Bid)
            .join(Request, col(Request.id) == col(Bid.request_id))
            .join(Profile, col(Profile.id) == col(Bid.profile_id))
            .join(User, col(User.id) == col(Profile.user_id))
            .where(Request.founder_id == founder_id, User.status == "confirmed")
        )
    ).one()
    bookings = (
        await session.exec(
            select(func.count()).select_from(Booking).where(Booking.founder_id == founder_id)
        )
    ).one()
    return {
        "briefs": briefs,
        "routes": {status: by_status.get(status, 0) for status in ROUTE_STATUSES},
        "open_requests": open_requests,
        "bids_received": bids_received,
        "bookings": bookings,
    }


async def bids_received(
    session: AsyncSession, founder_id: UUID, limit: int = 10
) -> list[tuple[Bid, Request, Profile]]:
    """Bids on the founder's requests from currently confirmed builders, newest first, capped."""
    statement = (
        select(Bid, Request, Profile)
        .join(Request, col(Request.id) == col(Bid.request_id))
        .join(Profile, col(Profile.id) == col(Bid.profile_id))
        .join(User, col(User.id) == col(Profile.user_id))
        .where(Request.founder_id == founder_id, User.status == "confirmed")
        .order_by(col(Bid.created_at).desc(), col(Bid.id))
        .limit(limit)
    )
    return [(b, r, p) for b, r, p in (await session.exec(statement)).all()]


async def upcoming_bookings(
    session: AsyncSession, founder_id: UUID, now: datetime
) -> list[BookingRow]:
    """The founder's bookings whose proposed start is at or after `now`, soonest first."""
    statement = _bookings_upcoming_first().where(
        Booking.founder_id == founder_id, Booking.proposed_start >= now
    )
    return [(b, p, u, r) for b, p, u, r in (await session.exec(statement)).all()]


async def bids_for_profile(session: AsyncSession, profile: Profile) -> list[tuple[Bid, Request]]:
    """The builder's own bids with their requests, newest first."""
    statement = (
        select(Bid, Request)
        .join(Request, col(Request.id) == col(Bid.request_id))
        .where(Bid.profile_id == profile.id)
        .order_by(col(Bid.created_at).desc(), col(Bid.id))
    )
    return [(row, request) for row, request in (await session.exec(statement)).all()]
