"""Public Showcase reads (Sprint 005a, spec #86, #101): the gallery and one entry's detail.

No auth dependency: a token, if sent, is ignored, never required. Every query starts from
`repo.visible_showcase_projects()`, the one visibility rule. A hidden, missing or malformed id
answers the same 404 body, so the endpoint is no existence oracle. No response shape carries
email, phone, location, day rate or availability (D-43); the builder is named by `builderId`.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_session
from app.marketplace import repo
from app.marketplace.links import LinkError, youtube_video_id
from app.marketplace.models import Profile, Project
from app.marketplace.schemas import (
    CredentialOut,
    MatchedSkill,
    ShowcaseBuilder,
    ShowcaseCard,
    ShowcaseDetail,
    ShowcasePage,
)
from app.marketplace.verification import ConfirmedRows, profile_skills, verified_skills
from app.models.brief import Vertical

router = APIRouter(prefix="/api/showcase")

NOT_FOUND = "showcase entry not found"


def _pitch_video_id(url: str | None) -> str | None:
    if url is None:
        return None
    try:
        return youtube_video_id(url, field="pitchVideoUrl")
    except LinkError:
        return None


def _matched(
    skill: str,
    skill_ids: list[str],
    rows: ConfirmedRows,
    profile: Profile,
    names: dict[str, str],
) -> MatchedSkill | None:
    """The kind that matched, preferring demonstrated over verified over self-described."""
    if skill in skill_ids:
        return MatchedSkill(id=skill, label=names.get(skill, skill), kind="demonstrated")
    if skill in verified_skills(rows):
        return MatchedSkill(id=skill, label=names.get(skill, skill), kind="verified")
    for label in [*profile.skill_set, *profile.suggested_skills]:
        if label.lower() == skill.lower():
            return MatchedSkill(id=None, label=label, kind="self-described")
    return None


def _card(
    project: Project,
    profile: Profile,
    skill_ids: list[str],
    matched: MatchedSkill | None,
) -> ShowcaseCard:
    return ShowcaseCard(
        id=str(project.id),
        title=project.title,
        builder_id=profile.builder_id,
        display_name=profile.display_name,
        cohort_id=profile.cohort_id,
        vertical=project.vertical,
        licensable=project.licensable,
        description=project.description,
        skill_ids=skill_ids,
        matched_skill=matched,
        live_url=project.live_url,
        demo_url=project.demo_url,
        pitch_video_url=project.pitch_video_url,
        pitch_deck_url=project.pitch_deck_url,
        pitch_video_id=_pitch_video_id(project.pitch_video_url),
        demo_data=project.demo_data,
    )


@router.get("", response_model=ShowcasePage)
async def showcase_list(
    session: Annotated[AsyncSession, Depends(get_session)],
    skill: Annotated[str | None, Query(max_length=40)] = None,
    vertical: Vertical | None = None,
    licensable: bool | None = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=24)] = 12,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ShowcasePage:
    wanted = (skill or "").strip() or None
    rows, total = await repo.showcase_page(
        session,
        skill=wanted,
        vertical=vertical,
        licensable=licensable,
        q=(q or "").strip() or None,
        limit=limit,
        offset=offset,
    )
    skills = await repo.skill_ids_by_project(session, [project.id for project, _ in rows])
    confirmed: dict[UUID, ConfirmedRows] = {}
    names: dict[str, str] = {}
    if wanted is not None and rows:
        confirmed = await repo.confirmed_rows_for_many(session, [p.id for _, p in rows])
        names = await repo.skill_names(session)
    items = [
        _card(
            project,
            profile,
            skills[project.id],
            None
            if wanted is None
            else _matched(wanted, skills[project.id], confirmed[profile.id], profile, names),
        )
        for project, profile in rows
    ]
    return ShowcasePage(items=items, total=total)


@router.get("/{project_id}", response_model=ShowcaseDetail)
async def showcase_detail(
    project_id: str, session: Annotated[AsyncSession, Depends(get_session)]
) -> ShowcaseDetail:
    try:
        parsed = UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from None
    found = await repo.visible_showcase_project(session, parsed)
    if found is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    project, profile = found
    skill_ids = (await repo.skill_ids_by_project(session, [project.id]))[project.id]
    rows = await repo.confirmed_rows_for(session, profile.id)
    names = await repo.skill_names(session)
    certifications = [
        CredentialOut(
            id=str(row.id),
            title=row.title,
            issuer=row.issuer,
            skill_id=row.skill_id,
            issued_on=row.issued_on,
            credential_url=row.credential_url,
            status="confirmed",
            demo_data=row.demo_data,
        )
        for row in await repo.confirmed_credentials_for(session, profile.id)
    ]
    return ShowcaseDetail(
        id=str(project.id),
        title=project.title,
        vertical=project.vertical,
        licensable=project.licensable,
        description=project.description,
        completed_on=project.completed_on,
        skill_ids=skill_ids,
        live_url=project.live_url,
        demo_url=project.demo_url,
        pitch_video_url=project.pitch_video_url,
        pitch_deck_url=project.pitch_deck_url,
        pitch_video_id=_pitch_video_id(project.pitch_video_url),
        builder=ShowcaseBuilder(
            builder_id=profile.builder_id,
            display_name=profile.display_name,
            cohort_id=profile.cohort_id,
            # Verified only (D-39): no self-described vocabulary ids are passed in.
            verified_skills=profile_skills(rows, [], names),
            skill_set=[*profile.skill_set, *profile.suggested_skills],
            certifications=certifications,
            github_url=profile.github_url,
            linkedin_url=profile.linkedin_url,
        ),
        demo_data=project.demo_data,
    )
