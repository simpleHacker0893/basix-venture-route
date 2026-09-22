"""Seam: pure function assemble(tuples, day_rates, brief) (Sprint 001, D-19).

Table-driven over hand-built EligibleTuple inputs; no runtime, no HTTP. Expected teams, totals
and gaps are literals from planning/DOMAIN.md §Team assembly and D-22.
"""

from datetime import date
from typing import Any

import pytest

from app.models.brief import VentureBrief
from app.models.engine import EligibleTuple, EvidenceType, ReasoningPath, RuleName
from app.routing.assembler import assemble


def tup(builder: str, skill: str, evidence: EvidenceType) -> EligibleTuple:
    return EligibleTuple(
        builder_id=builder,
        skill_id=skill,
        evidence=evidence,
        path=ReasoningPath(
            rule=RuleName.ELIGIBLE_BUILDER,
            facts=[f"(confirmed admin-basix {builder})"],
            conclusion=f"{builder} is eligible for {skill} with {evidence} evidence",
        ),
    )


def brief(skills: list[str], team: int, budget: int) -> VentureBrief:
    return VentureBrief.model_validate(
        {
            "id": "brief-test",
            "title": "table case",
            "vertical": "health",
            "requiredSkills": skills,
            "maximumTeamSize": team,
            "availabilityStart": date(2026, 9, 22),
            "availabilityEnd": date(2026, 9, 29),
            "deliveryMode": "hybrid",
            "dailyBudget": budget,
            "preferReusableIp": False,
        }
    )


HEALTH_TUPLES = [
    tup("amina-otieno", "python", "both"),
    tup("daniel-kiptoo", "ai-metta", "both"),
    tup("grace-wambui", "ui-ux", "credential"),
]
HEALTH_RATES = {"amina-otieno": 120, "daniel-kiptoo": 150, "grace-wambui": 100}

CASES: list[tuple[str, list[EligibleTuple], dict[str, int], VentureBrief, dict[str, Any]]] = [
    (
        "health pilot: one builder per skill, within size and budget",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 3, 400),
        {
            "team": ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
            "total": 370,
            "gaps": [],
        },
    ),
    (
        "fewer people beats lower total rate",
        [
            tup("solo-dev", "python", "credential"),
            tup("solo-dev", "ui-ux", "credential"),
            tup("cheap-py", "python", "both"),
            tup("cheap-ux", "ui-ux", "both"),
        ],
        {"solo-dev": 250, "cheap-py": 100, "cheap-ux": 100},
        brief(["python", "ui-ux"], 3, 400),
        {"team": ["solo-dev"], "total": 250, "gaps": []},
    ),
    (
        "agri: lower cost beats stronger evidence (lucy-achieng over brian-odhiambo)",
        [
            tup("wanjiru-mwangi", "frontend", "credential"),
            tup("brian-odhiambo", "backend", "credential"),
            tup("lucy-achieng", "backend", "project"),
            tup("fatuma-hassan", "domain-research", "credential"),
        ],
        {"wanjiru-mwangi": 140, "brian-odhiambo": 120, "lucy-achieng": 95, "fatuma-hassan": 80},
        brief(["frontend", "backend", "domain-research"], 3, 350),
        {"team": ["fatuma-hassan", "lucy-achieng", "wanjiru-mwangi"], "total": 315, "gaps": []},
    ),
    (
        "same size and cost: stronger evidence wins over lower builder id",
        [tup("abe", "python", "credential"), tup("zed", "python", "both")],
        {"abe": 100, "zed": 100},
        brief(["python"], 1, 200),
        {"team": ["zed"], "total": 100, "gaps": []},
    ),
    (
        "same size, cost and evidence: builder ids ascending",
        [tup("zed", "python", "credential"), tup("abe", "python", "credential")],
        {"abe": 100, "zed": 100},
        brief(["python"], 1, 200),
        {"team": ["abe"], "total": 100, "gaps": []},
    ),
    (
        "budget challenge (D-22): cheapest covering team named, no builders shown",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 3, 250),
        {
            "team": [],
            "total": 0,
            "gaps": [
                {
                    "category": "budget",
                    "rule": "assembler.budget-fit",
                    "affected": ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
                    "statement": "Cheapest verified team costs USD 370 a day; budget is USD 250",
                    "nextActions": ["Raise daily budget to USD 370"],
                }
            ],
        },
    ),
    (
        "team-size gap mirrors the budget gap (D-22)",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 2, 400),
        {
            "team": [],
            "total": 0,
            "gaps": [
                {
                    "category": "team-size",
                    "rule": "assembler.team-size-fit",
                    "affected": ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
                    "statement": "Smallest verified team needs 3 people; maximum team size is 2",
                    "nextActions": ["Raise maximum team size to 3"],
                }
            ],
        },
    ),
    (
        "constrained brief: the assembler covers only satisfiable skills, never fabricates",
        [tup("zawadi-njoroge", "rust", "credential")],
        {"zawadi-njoroge": 130},
        brief(["mobile", "rust"], 2, 300),
        {"team": ["zawadi-njoroge"], "total": 130, "gaps": []},
    ),
    (
        "no eligible tuples: empty team, no assembler gap (status is the route service's call)",
        [],
        {},
        brief(["python"], 3, 400),
        {"team": [], "total": 0, "gaps": []},
    ),
]


@pytest.mark.parametrize(("label", "tuples", "rates", "the_brief", "expected"), CASES)
def test_assemble_table(
    label: str,
    tuples: list[EligibleTuple],
    rates: dict[str, int],
    the_brief: VentureBrief,
    expected: dict[str, Any],
) -> None:
    assembly = assemble(tuples, rates, the_brief)

    assert [b.builder_id for b in assembly.builders] == expected["team"], label
    assert assembly.total_daily_rate == expected["total"], label
    assert [g.model_dump(by_alias=True) for g in assembly.gaps] == expected["gaps"], label


def test_assembled_builders_carry_display_name_rate_evidence_and_paths() -> None:
    assembly = assemble(HEALTH_TUPLES, HEALTH_RATES, brief(["python", "ai-metta", "ui-ux"], 3, 400))

    amina, daniel, grace = assembly.builders
    assert (amina.name, amina.day_rate, amina.covers, amina.evidence_type) == (
        "Amina Otieno",
        120,
        ["python"],
        "both",
    )
    assert (daniel.name, daniel.evidence_type) == ("Daniel Kiptoo", "both")
    assert (grace.name, grace.evidence_type) == ("Grace Wambui", "credential")
    assert amina.evidence_paths == [HEALTH_TUPLES[0].path]
    assert assembly.covered_skills == ["ai-metta", "python", "ui-ux"]


def test_missing_day_rate_is_an_error_not_a_guess() -> None:
    with pytest.raises(KeyError):
        assemble(HEALTH_TUPLES, {}, brief(["python", "ai-metta", "ui-ux"], 3, 400))
