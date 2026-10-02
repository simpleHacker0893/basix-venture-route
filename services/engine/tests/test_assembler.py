"""Seam: pure function assemble(tuples, hourly_rates, brief) (Sprint 001, D-19).

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
            "hourlyBudget": budget,
            "preferReusableIp": False,
        }
    )


HEALTH_TUPLES = [
    tup("amina-otieno", "python", "both"),
    tup("daniel-kiptoo", "ai-metta", "both"),
    tup("grace-wambui", "ui-ux", "credential"),
]
HEALTH_RATES = {"amina-otieno": 15, "daniel-kiptoo": 19, "grace-wambui": 13}

CASES: list[tuple[str, list[EligibleTuple], dict[str, int], VentureBrief, dict[str, Any]]] = [
    (
        "health pilot: one builder per skill, within size and budget",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 3, 50),
        {
            "team": ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
            "total": 47,
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
        {"solo-dev": 31, "cheap-py": 13, "cheap-ux": 13},
        brief(["python", "ui-ux"], 3, 50),
        {"team": ["solo-dev"], "total": 31, "gaps": []},
    ),
    (
        "agri: lower cost beats stronger evidence (lucy-achieng over brian-odhiambo)",
        [
            tup("wanjiru-mwangi", "frontend", "credential"),
            tup("brian-odhiambo", "backend", "credential"),
            tup("lucy-achieng", "backend", "project"),
            tup("fatuma-hassan", "domain-research", "credential"),
        ],
        {"wanjiru-mwangi": 18, "brian-odhiambo": 15, "lucy-achieng": 12, "fatuma-hassan": 10},
        brief(["frontend", "backend", "domain-research"], 3, 44),
        {"team": ["fatuma-hassan", "lucy-achieng", "wanjiru-mwangi"], "total": 40, "gaps": []},
    ),
    (
        "same size and cost: stronger evidence wins over lower builder id",
        [tup("abe", "python", "credential"), tup("zed", "python", "both")],
        {"abe": 13, "zed": 13},
        brief(["python"], 1, 25),
        {"team": ["zed"], "total": 13, "gaps": []},
    ),
    (
        "same size, cost and evidence: builder ids ascending",
        [tup("zed", "python", "credential"), tup("abe", "python", "credential")],
        {"abe": 13, "zed": 13},
        brief(["python"], 1, 25),
        {"team": ["abe"], "total": 13, "gaps": []},
    ),
    (
        "budget challenge (D-22): cheapest covering team named, no builders shown",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 3, 31),
        {
            "team": [],
            "total": 0,
            "gaps": [
                {
                    "category": "budget",
                    "rule": "assembler.budget-fit",
                    "affected": ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
                    "statement": (
                        "Cheapest verified team costs USD 47 an hour; budget is USD 31 an hour"
                    ),
                    "nextActions": ["Raise the hourly budget to USD 47"],
                }
            ],
        },
    ),
    (
        "team-size gap mirrors the budget gap (D-22)",
        HEALTH_TUPLES,
        HEALTH_RATES,
        brief(["python", "ai-metta", "ui-ux"], 2, 50),
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
        {"zawadi-njoroge": 16},
        brief(["mobile", "rust"], 2, 38),
        {"team": ["zawadi-njoroge"], "total": 16, "gaps": []},
    ),
    (
        "no eligible tuples: empty team, no assembler gap (status is the route service's call)",
        [],
        {},
        brief(["python"], 3, 50),
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
    assert assembly.total_hourly_rate == expected["total"], label
    assert [g.model_dump(by_alias=True) for g in assembly.gaps] == expected["gaps"], label


def test_assembled_builders_carry_display_name_rate_evidence_and_paths() -> None:
    assembly = assemble(HEALTH_TUPLES, HEALTH_RATES, brief(["python", "ai-metta", "ui-ux"], 3, 50))

    amina, daniel, grace = assembly.builders
    assert (amina.name, amina.hourly_rate, amina.covers, amina.evidence_type) == (
        "Amina Otieno",
        15,
        ["python"],
        "both",
    )
    assert (daniel.name, daniel.evidence_type) == ("Daniel Kiptoo", "both")
    assert (grace.name, grace.evidence_type) == ("Grace Wambui", "credential")
    assert amina.evidence_paths == [HEALTH_TUPLES[0].path]
    assert assembly.covered_skills == ["ai-metta", "python", "ui-ux"]


def test_missing_hourly_rate_is_an_error_not_a_guess() -> None:
    with pytest.raises(KeyError):
        assemble(HEALTH_TUPLES, {}, brief(["python", "ai-metta", "ui-ux"], 3, 50))


def test_a_team_costing_exactly_the_hourly_budget_fits() -> None:
    """D-59 boundary: a team fits when the sum of hourly rates is at most the budget."""
    assembly = assemble(HEALTH_TUPLES, HEALTH_RATES, brief(["python", "ai-metta", "ui-ux"], 3, 47))

    assert [b.builder_id for b in assembly.builders] == [
        "amina-otieno",
        "daniel-kiptoo",
        "grace-wambui",
    ]
    assert assembly.total_hourly_rate == 47
    assert assembly.gaps == []


def test_a_budget_one_dollar_below_the_team_total_is_a_budget_gap_naming_the_total() -> None:
    assembly = assemble(HEALTH_TUPLES, HEALTH_RATES, brief(["python", "ai-metta", "ui-ux"], 3, 46))

    assert assembly.builders == []
    assert assembly.total_hourly_rate == 0
    [gap] = assembly.gaps
    assert (gap.category, gap.rule) == ("budget", RuleName.ASSEMBLER_BUDGET_FIT)
    assert gap.statement == "Cheapest verified team costs USD 47 an hour; budget is USD 46 an hour"
    assert gap.next_actions == ["Raise the hourly budget to USD 47"]
