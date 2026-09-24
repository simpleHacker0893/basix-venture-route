"""Seam: `render_program()` output and `RouteService` over the five demo scenarios (#98, D-52).

Showcase entries, `skill_set` labels, accepted `suggested_skills` and skill-less certifications
become display-only facts in the MeTTa space: `(showcases b p)`, `(has-skill-set b "<label>")`,
`(suggested-skill b "<label>")`, `(certified b cert "<issuer>")`. No rule reads them, so the five
demo scenarios route deep-equal before and after (the route-equality test that replaces the
byte-equal invariant), and typed or suggested skills never make a builder eligible (AGENTS.md
rule 4). Spec #86 Testing 6 and 7.
"""

from datetime import date
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.metta_engine import MettaRouteEngine
from app.engine.projection import render_program, reproject
from app.marketplace import repo
from app.marketplace.models import Project
from app.marketplace.verification import (
    ConfirmedBuilder,
    ConfirmedCertification,
    ConfirmedCredential,
    ConfirmedProject,
    ConfirmedRows,
)
from app.models.brief import VentureBrief
from app.routing.route_service import RouteService
from tests.conftest import Actor, Decide, _user, builder_profile_input

SCENARIOS = (
    "brief-health-01",
    "brief-agri-01",
    "brief-constrained-01",
    "brief-budget-01",
    "brief-onsite-01",
)

CRED_WITH_SKILL = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
CERT_NO_SKILL = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SHOWN = "33333333-cccc-4ccc-8ccc-cccccccccccc"
HIDDEN = "44444444-dddd-4ddd-8ddd-dddddddddddd"

HOSTILE = 'a"b\\c) (confirmed admin-basix x)\n(proves cred-x mobile) ; tail'


def _builder(**overrides: Any) -> ConfirmedBuilder:
    fields: dict[str, Any] = {
        "builder_id": "naomi-chebet",
        "day_rate": 120,
        "location": "Nairobi",
        "modes": ("remote",),
        "availability": ((date(2026, 9, 22), date(2026, 10, 20)),),
        "cohort_id": None,
        "self_described": ("mobile",),
        "rows": ConfirmedRows(
            credentials=(ConfirmedCredential(credential_id=CRED_WITH_SKILL, skill_id="mobile"),),
            projects=(
                ConfirmedProject(
                    project_id=SHOWN,
                    skill_ids=("mobile",),
                    licensable=False,
                    vertical="agri",
                    showcase_visible=True,
                ),
                ConfirmedProject(
                    project_id=HIDDEN, skill_ids=("mobile",), licensable=False, vertical="agri"
                ),
            ),
            certifications=(
                ConfirmedCertification(credential_id=CERT_NO_SKILL, issuer="Amazon Web Services"),
            ),
        ),
        "skill_set": ("Figma", "Product design"),
        "suggested_skills": ("Data analysis",),
    }
    fields.update(overrides)
    return ConfirmedBuilder(**fields)


# -- render_program(): pure ------------------------------------------------------------------------


def test_display_facts_render_in_their_exact_forms() -> None:
    lines = render_program([_builder()])

    display = [
        line
        for line in lines
        if line.startswith(("(showcases", "(has-skill-set", "(suggested-skill", "(certified"))
    ]
    assert display == [
        '(has-skill-set naomi-chebet "Figma")',
        '(has-skill-set naomi-chebet "Product design")',
        '(suggested-skill naomi-chebet "Data analysis")',
        '(certified naomi-chebet cred-22222222 "Amazon Web Services")',
        "(showcases naomi-chebet proj-33333333)",
    ]


def test_a_skill_less_certification_never_proves_or_earns() -> None:
    lines = render_program([_builder()])

    assert not [line for line in lines if "cred-22222222" in line and "certified" not in line]
    # the vocabulary credential keeps exactly today's three atoms
    assert [line for line in lines if "cred-11111111" in line] == [
        "(earned naomi-chebet cred-11111111)",
        "(proves cred-11111111 mobile)",
        "(confirmed admin-basix cred-11111111)",
    ]


def test_only_a_visible_showcase_entry_projects_showcases() -> None:
    lines = render_program([_builder()])

    assert "(showcases naomi-chebet proj-44444444)" not in lines
    assert "(built naomi-chebet proj-44444444)" in lines


def test_a_hostile_label_renders_as_exactly_one_escaped_string_atom() -> None:
    lines = render_program([_builder(skill_set=(HOSTILE,), suggested_skills=())])

    hostile = [line for line in lines if line.startswith("(has-skill-set")]
    assert hostile == [
        '(has-skill-set naomi-chebet "a\\"b\\\\c) (confirmed admin-basix x)\\n'
        '(proves cred-x mobile) ; tail")'
    ]
    assert all("\n" not in line for line in lines)


def test_control_characters_never_break_the_line_or_reach_the_runtime_raw() -> None:
    label = "tab\there\rcr\x00nul\x07bell\u2028ls\u200bzw"
    lines = render_program([_builder(skill_set=(label,), suggested_skills=())])

    (line,) = [line for line in lines if line.startswith("(has-skill-set")]
    assert line == (
        '(has-skill-set naomi-chebet "tab\\there\\rcr\ufffdnul\\u{7}bell\\u{2028}ls\\u{200b}zw")'
    )
    assert line.isprintable()


# -- the rendered program in the real runtime ------------------------------------------------------


@pytest.mark.runtime
def test_escaped_labels_load_as_exactly_one_atom_each(engine: MettaRouteEngine) -> None:
    label = HOSTILE + "\t\x07\u2028"
    program = render_program([_builder(skill_set=(label, "Figma"), suggested_skills=(HOSTILE,))])
    try:
        projected = engine.replace_space("\n".join(program))
        assert projected == len(program)
        labels = engine._query("!(match &self (has-skill-set naomi-chebet $l) $l)")
        suggested = engine._query("!(match &self (suggested-skill naomi-chebet $l) $l)")
        smuggled = engine._query("!(match &self (confirmed admin-basix x) found)")
        assert len(labels) == 2
        assert len(suggested) == 1
        assert smuggled == []
    finally:
        engine.replace_space("")


# -- route-equality over the five demo scenarios (RouteService, real runtime) ---------------------


def _routes(engine: MettaRouteEngine, briefs: dict[str, VentureBrief]) -> dict[str, Any]:
    service = RouteService(engine)
    return {brief_id: service.route(briefs[brief_id]).model_dump() for brief_id in SCENARIOS}


@pytest.mark.anyio
async def test_display_facts_leave_the_five_scenarios_route_equal(
    api: AsyncClient,
    confirmed_builder: Actor,
    db_session: AsyncSession,
    admin: Actor,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    before_count = await reproject(engine, db_session)
    before = _routes(engine, briefs)
    headers = confirmed_builder.headers

    showcase = await api.put(
        f"/api/me/projects/{confirmed_builder.ids['project']}/showcase",
        json={"description": "A field survey app.", "showcased": True},
        headers=headers,
    )
    assert showcase.status_code == 200, showcase.text
    project = await db_session.get(Project, UUID(confirmed_builder.ids["project"]))
    assert project is not None
    await db_session.refresh(project)
    project.showcase_status = "confirmed"  # what #103's admin decision leaves behind
    db_session.add(project)
    await db_session.commit()

    profile = builder_profile_input("Naomi Chebet") | {
        "skillSet": ["Figma", HOSTILE[:40].strip()],
        "suggestedSkills": ["Data analysis"],
    }
    saved = await api.put("/api/me/profile", json=profile, headers=headers)
    assert saved.status_code == 200, saved.text
    cert = await api.post(
        "/api/me/credentials",
        json={"title": "AWS Cloud Practitioner", "issuer": "Amazon Web Services"},
        headers=headers,
    )
    assert cert.status_code == 201, cert.text
    assert await repo.decide(
        db_session, "credential", UUID(cert.json()["id"]), "confirmed", admin.user_id
    )

    after_count = await reproject(engine, db_session)
    after = _routes(engine, briefs)

    # 1 showcases + 2 has-skill-set + 1 suggested-skill + 1 certified, nothing else
    assert after_count - before_count == 5
    assert after == before


@pytest.mark.anyio
async def test_a_builder_with_only_typed_or_suggested_skills_is_never_eligible(
    api: AsyncClient,
    db_session: AsyncSession,
    bearer: Any,
    decide: Decide,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    seed_only = _routes(engine, briefs)
    user = await _user(db_session, bearer, "user_typed", "builder")
    profile = builder_profile_input("Typed Only") | {
        "location": "Kisumu",
        "modes": {"remote": True, "hybrid": True, "onSite": True},
        "selfDescribedSkills": [],
        "availability": [{"start": "2026-09-01", "end": "2026-10-31"}],
        "skillSet": ["python", "ai-metta", "ui-ux", "frontend", "backend", "domain-research"],
        "suggestedSkills": ["mobile", "rust"],
    }
    saved = await api.put("/api/me/profile", json=profile, headers=user.headers)
    assert saved.status_code == 200, saved.text
    builder_id = saved.json()["builderId"]
    typed = Actor(
        clerk_id=user.clerk_id,
        role="builder",
        headers=user.headers,
        user_id=user.user_id,
        builder_id=builder_id,
        ids={"account": str(user.user_id)},
    )

    projected = await decide(typed, {"account": "confirmed"})

    assert projected > 0
    for brief_id in SCENARIOS:
        eligible = engine.eligible_builders(briefs[brief_id])
        assert builder_id not in {row.builder_id for row in eligible}, brief_id
    assert _routes(engine, briefs) == seed_only
