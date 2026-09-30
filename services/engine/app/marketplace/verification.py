"""The verified-skill derivation (DOMAIN.md §Marketplace rules, spec #35 §Marketplace API).

A skill on a profile is `verified` only if a confirmed credential proves it or a confirmed
project demonstrates it. This is one pure function over `ConfirmedRows`, the same input the
graph projection consumes, so the API and the engine can never disagree about what is proven.
A self-described skill that is also proven renders as verified.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from app.marketplace.schemas import Evidence, ProfileSkill, SkillStatus

SkillId = str


@dataclass(frozen=True)
class ConfirmedCredential:
    credential_id: str
    skill_id: SkillId


@dataclass(frozen=True)
class ConfirmedProject:
    project_id: str
    skill_ids: tuple[SkillId, ...]
    licensable: bool
    vertical: str
    # True only when the entry passes the one public visibility rule
    # (repo.visible_showcase_projects): display-only, read by no rule and by no verification
    # (D-52).
    showcase_visible: bool = False


@dataclass(frozen=True)
class ConfirmedCertification:
    """A confirmed credential with no vocabulary skill (#88): display-only, proves nothing."""

    credential_id: str
    issuer: str


@dataclass(frozen=True)
class ConfirmedRows:
    """Everything confirmed about one builder: credentials and projects with status confirmed.
    `certifications` are the skill-less credentials; `verified_skills` never reads them."""

    credentials: tuple[ConfirmedCredential, ...] = field(default_factory=tuple)
    projects: tuple[ConfirmedProject, ...] = field(default_factory=tuple)
    certifications: tuple[ConfirmedCertification, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ConfirmedBuilder:
    """A builder whose account is confirmed, with everything the projection emits for them."""

    builder_id: str
    day_rate: int
    location: str
    modes: tuple[str, ...]
    availability: tuple[tuple[date, date], ...]
    cohort_id: str | None
    self_described: tuple[str, ...]
    rows: ConfirmedRows
    # Free-text skill chips (#88, D-52): display-only facts, never evidence (AGENTS.md rule 4).
    skill_set: tuple[str, ...] = ()
    suggested_skills: tuple[str, ...] = ()


def verified_skills(rows: ConfirmedRows) -> dict[SkillId, Evidence]:
    """Skill id → evidence type, for the skills a confirmed credential or project proves."""
    by_credential = {credential.skill_id for credential in rows.credentials}
    by_project = {skill for project in rows.projects for skill in project.skill_ids}
    out: dict[SkillId, Evidence] = {}
    for skill in by_credential | by_project:
        proof: Literal["credential", "project", "both"]
        if skill in by_credential and skill in by_project:
            proof = "both"
        elif skill in by_credential:
            proof = "credential"
        else:
            proof = "project"
        out[skill] = proof
    return out


def profile_skills(
    rows: ConfirmedRows,
    self_described: list[str],
    names: dict[SkillId, str],
) -> list[ProfileSkill]:
    """The skill list a profile shows: verified ones first (seed order), then the self-described
    ones that are not proven, each rendered `Self-described · display only` by the web app."""
    verified = verified_skills(rows)
    ordered = [skill for skill in names if skill in verified]
    ordered += [skill for skill in self_described if skill not in verified]
    out: list[ProfileSkill] = []
    for skill in ordered:
        status: SkillStatus = "verified" if skill in verified else "self-described"
        out.append(
            ProfileSkill(
                id=skill,  # ids come from the skills table
                name=names.get(skill, skill),
                status=status,
                evidence=verified.get(skill),
            )
        )
    return out
