"""Seed the Showcase demo: Venture Route itself plus fictional entries (Sprint 005a, #107).

Reads `seed/showcase_demo.json` (Operator-editable: titles, descriptions, links) and writes, for
each entry, a confirmed seed builder (user, profile, one skill-less certification) and a
confirmed, showcased project, plus the `confirmations` rows (account, credential, project,
showcase) an admin decision would leave behind, signed by a seed admin. Then it reprojects once.

Guarantees:

- Idempotent. Every row id is a fixed uuid5 over `SEED_NAMESPACE` and a stable key; a row that
  exists is updated in place (only the fields that differ), so a second run changes nothing.
- Every row is `demo_data=true`.
- Never touches a real Clerk sign-up: rows are addressed by their fixed ids only, seed Clerk ids
  are `seed_demo_<slug>` / `seed_basix_admin` (Clerk issues `user_...` ids, so no session can
  ever carry them) and emails end in `.invalid`. If a real account already holds a seed builder
  id, Clerk id or email, the run aborts before writing anything.
- Never changes a route. Seed builders have no availability ranges and no `mobile` skill, and
  the only licensable entry is in a vertical no demo brief asks for, so no MeTTa rule result
  moves (spec #86 Testing 7); the display facts are ones no rule reads (D-52).

The running engine reprojects at start-up; the reprojection here proves the seeded rows load
into a fresh space and reports the atom count.

Usage (from services/engine, DATABASE_URL in the environment or `.env`):
    uv run python scripts/seed_showcase_demo.py
    uv run python scripts/seed_showcase_demo.py --file path/to/showcase_demo.json
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5

os.environ.setdefault("LLM_PROVIDER", "null")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator  # noqa: E402
from sqlalchemy import or_  # noqa: E402
from sqlmodel import SQLModel, col, select  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from app.config import PACKAGE_ROOT, get_settings  # noqa: E402
from app.db.session import create_session_factory, create_store_engine  # noqa: E402
from app.engine.metta_engine import MettaRouteEngine  # noqa: E402
from app.engine.projection import reproject  # noqa: E402
from app.marketplace import links  # noqa: E402
from app.marketplace.models import (  # noqa: E402
    PROJECT_DESCRIPTION_MAX,
    Confirmation,
    Credential,
    Profile,
    Project,
    ProjectSkill,
    User,
)
from app.models.brief import Vertical  # noqa: E402

DEMO_PATH = PACKAGE_ROOT / "seed" / "showcase_demo.json"

# Fixed namespace: every seed id is uuid5(SEED_NAMESPACE, "<kind>:<key>"). Never change it.
SEED_NAMESPACE = UUID("7d0c2a4e-5b1f-5e8a-9c3d-0f6b1e2a7c41")

ADMIN_KEY = "seed-basix-admin"
ADMIN_CLERK_ID = "seed_basix_admin"
EMAIL_DOMAIN = "seed.venture-route.invalid"

# Seed builders: never a location, rate or availability the demo depends on (no ranges at all).
SEED_LOCATION = "Nairobi"
SEED_DAY_RATE = 150

# Gallery order is newest confirmation first: entry 0 gets the latest instant.
SHOWCASE_CONFIRMED_BASE = datetime(2026, 9, 22, 9, 0, tzinfo=UTC)

_BUILDER_ID = re.compile(r"demo-[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
FORBIDDEN_SKILLS = frozenset({"mobile"})


def seed_id(kind: str, key: str) -> UUID:
    return uuid5(SEED_NAMESPACE, f"{kind}:{key}")


class SeedError(RuntimeError):
    """The seed refuses to run; nothing was written."""


# -- the demo file ---------------------------------------------------------------------------------


class _Wire(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid", str_strip_whitespace=True)


class DemoCertification(_Wire):
    title: str = Field(min_length=1, max_length=120)
    issuer: str = Field(min_length=1, max_length=120)
    issued_on: date | None = Field(default=None, alias="issuedOn")


class DemoOwner(_Wire):
    builder_id: str = Field(alias="builderId", max_length=60)
    name: str = Field(min_length=1, max_length=80)
    headline: str = Field(default="", max_length=120)
    cohort: str | None = Field(default=None, min_length=1, max_length=40)
    skill_set: list[str] = Field(alias="skillSet", min_length=2, max_length=3)
    certification: DemoCertification
    github_url: str | None = Field(default=None, alias="githubUrl")
    linkedin_url: str | None = Field(default=None, alias="linkedinUrl")

    @field_validator("builder_id")
    @classmethod
    def _demo_slug(cls, value: str) -> str:
        if not _BUILDER_ID.fullmatch(value):
            raise ValueError("builderId must be a kebab-case slug starting with 'demo-'")
        return value

    @field_validator("skill_set")
    @classmethod
    def _labels(cls, value: list[str]) -> list[str]:
        labels = [label.strip() for label in value]
        if any(not label or len(label) > 40 for label in labels):
            raise ValueError("skillSet labels must be 1-40 characters")
        if len({label.lower() for label in labels}) != len(labels):
            raise ValueError("skillSet must not repeat a label regardless of case")
        return labels

    @field_validator("github_url")
    @classmethod
    def _github(cls, value: str | None) -> str | None:
        return None if value is None else links.github_profile_url(value, field="githubUrl")

    @field_validator("linkedin_url")
    @classmethod
    def _linkedin(cls, value: str | None) -> str | None:
        return None if value is None else links.linkedin_profile_url(value, field="linkedinUrl")

    @property
    def user_id(self) -> UUID:
        return seed_id("user", self.builder_id)

    @property
    def profile_id(self) -> UUID:
        return seed_id("profile", self.builder_id)

    @property
    def credential_id(self) -> UUID:
        return seed_id("credential", self.builder_id)

    @property
    def clerk_id(self) -> str:
        return f"seed_demo_{self.builder_id.removeprefix('demo-').replace('-', '_')}"

    @property
    def email(self) -> str:
        return f"{self.builder_id}@{EMAIL_DOMAIN}"


class DemoEntry(_Wire):
    key: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(max_length=PROJECT_DESCRIPTION_MAX)
    vertical: Vertical
    skills: list[str] = Field(min_length=1)
    licensable: bool = False
    completed_on: date = Field(alias="completedOn")
    live_url: str | None = Field(default=None, alias="liveUrl")
    demo_url: str | None = Field(default=None, alias="demoUrl")
    pitch_deck_url: str | None = Field(default=None, alias="pitchDeckUrl")
    pitch_video_url: str | None = Field(default=None, alias="pitchVideoUrl")
    owner: DemoOwner

    @field_validator("skills")
    @classmethod
    def _skills(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("skills must not repeat")
        forbidden = FORBIDDEN_SKILLS.intersection(value)
        if forbidden:
            raise ValueError(f"seed entries never carry {sorted(forbidden)}")
        return value

    @field_validator("live_url", "demo_url", "pitch_deck_url")
    @classmethod
    def _https(cls, value: str | None) -> str | None:
        return None if value is None else links.validate_https_url(value, field="link")

    @field_validator("pitch_video_url")
    @classmethod
    def _youtube(cls, value: str | None) -> str | None:
        if value is None:
            return None
        links.youtube_video_id(value, field="pitchVideoUrl")
        return value.strip()

    @property
    def project_id(self) -> UUID:
        return seed_id("project", self.key)


class ShowcaseDemo(_Wire):
    comment: str = Field(default="", alias="_comment")
    entries: list[DemoEntry] = Field(min_length=1)

    @field_validator("entries")
    @classmethod
    def _unique(cls, value: list[DemoEntry]) -> list[DemoEntry]:
        keys = [entry.key for entry in value]
        owners = [entry.owner.builder_id for entry in value]
        if len(set(keys)) != len(keys) or len(set(owners)) != len(owners):
            raise ValueError("entry keys and owner builderIds must be unique")
        return value


def load_demo(path: Path) -> ShowcaseDemo:
    """Parse and validate the demo file; raises SeedError naming the problem."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return ShowcaseDemo.model_validate(raw)
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as error:
        raise SeedError(f"cannot load {path.name}: {error}") from error


# -- writing ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SeedSummary:
    builders: int
    entries: int
    confirmations: int
    projected: int


async def _put[T: SQLModel](
    session: AsyncSession, model: type[T], key: Any, values: dict[str, Any]
) -> T:
    """Insert the row at its fixed key, or update only the fields that differ."""
    row = await session.get(model, key)
    if row is None:
        row = model(**values)
        session.add(row)
        return row
    for name, value in values.items():
        if getattr(row, name) != value:
            setattr(row, name, value)
    session.add(row)
    return row


async def _refuse_real_accounts(session: AsyncSession, demo: ShowcaseDemo) -> None:
    """Abort when a non-seed account already holds a seed Clerk id, email or builder id."""
    owners = [entry.owner for entry in demo.entries]
    ours = {owner.user_id for owner in owners} | {seed_id("user", ADMIN_KEY)}
    clerk_ids = [owner.clerk_id for owner in owners] + [ADMIN_CLERK_ID]
    emails = [owner.email for owner in owners] + [f"{ADMIN_KEY}@{EMAIL_DOMAIN}"]
    users = (
        await session.exec(
            select(User).where(or_(col(User.clerk_id).in_(clerk_ids), col(User.email).in_(emails)))
        )
    ).all()
    profiles = (
        await session.exec(
            select(Profile).where(col(Profile.builder_id).in_([o.builder_id for o in owners]))
        )
    ).all()
    clash = [u.clerk_id for u in users if u.id not in ours] + [
        p.builder_id for p in profiles if p.user_id not in ours
    ]
    if clash:
        raise SeedError(f"a non-seed account already holds {sorted(clash)}; nothing written")


async def _confirm(session: AsyncSession, kind: str, target: UUID, admin_id: UUID) -> None:
    await _put(
        session,
        Confirmation,
        seed_id(f"confirmation-{kind}", str(target)),
        {
            "id": seed_id(f"confirmation-{kind}", str(target)),
            "kind": kind,
            "target_id": target,
            "decision": "confirmed",
            "admin_user_id": admin_id,
            "demo_data": True,
        },
    )


async def seed(session: AsyncSession, demo: ShowcaseDemo) -> tuple[int, int]:
    """Write every seed row and commit; returns (entries, confirmations)."""
    await _refuse_real_accounts(session, demo)
    admin_id = seed_id("user", ADMIN_KEY)
    await _put(
        session,
        User,
        admin_id,
        {
            "id": admin_id,
            "clerk_id": ADMIN_CLERK_ID,
            "email": f"{ADMIN_KEY}@{EMAIL_DOMAIN}",
            "role": "admin",
            "status": "confirmed",
            "demo_data": True,
        },
    )
    confirmations = 0
    for index, entry in enumerate(demo.entries):
        owner = entry.owner
        await _put(
            session,
            User,
            owner.user_id,
            {
                "id": owner.user_id,
                "clerk_id": owner.clerk_id,
                "email": owner.email,
                "role": "builder",
                "status": "confirmed",
                "demo_data": True,
            },
        )
        await session.flush()
        await _put(
            session,
            Profile,
            owner.profile_id,
            {
                "id": owner.profile_id,
                "user_id": owner.user_id,
                "builder_id": owner.builder_id,
                "display_name": owner.name,
                "headline": owner.headline,
                "cohort_id": owner.cohort,
                "location": SEED_LOCATION,
                "day_rate": SEED_DAY_RATE,
                "supports_remote": True,
                "supports_hybrid": False,
                "supports_onsite": False,
                "self_described_skills": [],
                "phone": None,
                "linkedin": None,
                "share_email": False,
                "share_phone": False,
                "share_linkedin": False,
                "skill_set": owner.skill_set,
                "suggested_skills": [],
                "github_url": owner.github_url,
                "linkedin_url": owner.linkedin_url,
                "demo_data": True,
            },
        )
        await session.flush()
        cert = owner.certification
        await _put(
            session,
            Credential,
            owner.credential_id,
            {
                "id": owner.credential_id,
                "profile_id": owner.profile_id,
                "title": cert.title,
                "issuer": cert.issuer,
                "skill_id": None,
                "status": "confirmed",
                "issued_on": cert.issued_on,
                "credential_url": None,
                "demo_data": True,
            },
        )
        await _put(
            session,
            Project,
            entry.project_id,
            {
                "id": entry.project_id,
                "profile_id": owner.profile_id,
                "title": entry.title,
                "vertical": entry.vertical,
                "licensable": entry.licensable,
                "completed_on": entry.completed_on,
                "status": "confirmed",
                "description": entry.description,
                "live_url": entry.live_url,
                "demo_url": entry.demo_url,
                "pitch_video_url": entry.pitch_video_url,
                "pitch_deck_url": entry.pitch_deck_url,
                "showcased": True,
                "showcase_status": "confirmed",
                "showcase_confirmed_at": SHOWCASE_CONFIRMED_BASE - timedelta(hours=index),
                "demo_data": True,
            },
        )
        await session.flush()
        stale = (
            await session.exec(
                select(ProjectSkill).where(
                    ProjectSkill.project_id == entry.project_id,
                    col(ProjectSkill.skill_id).not_in(entry.skills),
                )
            )
        ).all()
        for link in stale:
            await session.delete(link)
        for skill in entry.skills:
            await _put(
                session,
                ProjectSkill,
                (entry.project_id, skill),
                {"project_id": entry.project_id, "skill_id": skill, "demo_data": True},
            )
        for kind, target in (
            ("account", owner.user_id),
            ("credential", owner.credential_id),
            ("project", entry.project_id),
            ("showcase", entry.project_id),
        ):
            await _confirm(session, kind, target, admin_id)
            confirmations += 1
    await session.commit()
    return len(demo.entries), confirmations


async def seed_and_reproject(
    session: AsyncSession, engine: MettaRouteEngine, demo: ShowcaseDemo
) -> SeedSummary:
    """Seed, then reproject exactly once."""
    entries, confirmations = await seed(session, demo)
    projected = await reproject(engine, session)
    return SeedSummary(
        builders=entries, entries=entries, confirmations=confirmations, projected=projected
    )


async def _run(url: str, demo: ShowcaseDemo) -> SeedSummary:
    store = create_store_engine(url)
    try:
        async with create_session_factory(store)() as session:
            return await seed_and_reproject(session, MettaRouteEngine(get_settings()), demo)
    finally:
        await store.dispose()


def main(argv: list[str]) -> int:
    path = DEMO_PATH
    if "--file" in argv:
        index = argv.index("--file")
        if index + 1 >= len(argv):
            print("[showcase seed] --file needs a path", file=sys.stderr)
            return 2
        path = Path(argv[index + 1])
    try:
        demo = load_demo(path)
        url = get_settings().database_url
        if url is None:
            raise SeedError("DATABASE_URL is unset or a placeholder; nothing seeded")
        summary = asyncio.run(_run(url, demo))
    except SeedError as error:
        print(f"[showcase seed] {error}", file=sys.stderr)
        return 1
    except Exception as error:  # the DB or runtime failed; the URL never appears in the report
        first = str(error).splitlines()[0] if str(error) else ""
        print(f"[showcase seed] failed: {type(error).__name__}: {first}", file=sys.stderr)
        return 1
    print(
        f"[showcase seed] {summary.entries} showcase entries by {summary.builders} demo builders, "
        f"{summary.confirmations} confirmations; projected {summary.projected} atoms"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
