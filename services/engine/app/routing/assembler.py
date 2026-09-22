"""assemble(tuples, day_rates, brief): the deterministic team assembler.

planning/DOMAIN.md §Team assembly, steps 1, 3 and 4; D-22 for the two assembler gaps.
Inputs are the engine's `EligibleTuple`s and the day rates read through `day_rates()` (D-24).
The function is pure: same inputs, same output; it never queries skills or the space.
"""

from __future__ import annotations

from itertools import combinations
from typing import cast

from app.models.brief import SkillId, VentureBrief
from app.models.engine import EligibleTuple, EngineModel, EvidenceType, Gap, RuleName
from app.models.route import RouteBuilder
from app.routing import next_actions
from app.routing.presenter import display_name

# Stronger evidence ranks higher: both > credential > project (DOMAIN.md step 4).
EVIDENCE_RANK: dict[EvidenceType, int] = {"project": 0, "credential": 1, "both": 2}

Team = tuple[str, ...]


class Assembly(EngineModel):
    """What the assembler decides; the route service adds status, IP, cohort, partner, summary."""

    builders: list[RouteBuilder]
    covered_skills: list[str]
    total_daily_rate: int
    gaps: list[Gap]


def assemble(
    tuples: list[EligibleTuple], day_rates: dict[str, int], brief: VentureBrief
) -> Assembly:
    required = set(brief.required_skills)
    coverage: dict[str, dict[str, EligibleTuple]] = {}
    for item in tuples:
        if item.skill_id in required:
            coverage.setdefault(item.builder_id, {})[item.skill_id] = item
    satisfiable = sorted({skill for skills in coverage.values() for skill in skills})
    if not satisfiable:
        return Assembly(builders=[], covered_skills=[], total_daily_rate=0, gaps=[])

    builders = sorted(coverage)
    rates = {builder: day_rates[builder] for builder in builders}

    def total(team: Team) -> int:
        return sum(rates[builder] for builder in team)

    def evidence_score(team: Team) -> int:
        """Per satisfiable skill, the strongest evidence any member brings; summed."""
        return sum(
            max(EVIDENCE_RANK[coverage[b][skill].evidence] for b in team if skill in coverage[b])
            for skill in satisfiable
        )

    def ordering(team: Team) -> tuple[int, int, int, Team]:
        return (len(team), total(team), -evidence_score(team), team)

    covering = sorted(
        (
            team
            for size in range(1, min(len(builders), len(satisfiable)) + 1)
            for team in combinations(builders, size)
            if {skill for b in team for skill in coverage[b]} >= set(satisfiable)
        ),
        key=ordering,
    )
    within_size = [team for team in covering if len(team) <= brief.maximum_team_size]
    if not within_size:
        smallest = covering[0]
        return _gap_only(
            satisfiable,
            Gap(
                category="team-size",
                statement=next_actions.team_size_statement(len(smallest), brief.maximum_team_size),
                affected=list(smallest),
                next_actions=next_actions.raise_team_size(len(smallest)),
                rule=RuleName.ASSEMBLER_TEAM_SIZE_FIT,
            ),
        )
    within_budget = [team for team in within_size if total(team) <= brief.daily_budget]
    if not within_budget:
        cheapest = min(within_size, key=lambda team: (total(team), ordering(team)))
        return _gap_only(
            satisfiable,
            Gap(
                category="budget",
                statement=next_actions.budget_statement(total(cheapest), brief.daily_budget),
                affected=list(cheapest),
                next_actions=next_actions.raise_daily_budget(total(cheapest)),
                rule=RuleName.ASSEMBLER_BUDGET_FIT,
            ),
        )

    chosen = within_budget[0]
    return Assembly(
        builders=[_route_builder(b, coverage[b], rates[b]) for b in chosen],
        covered_skills=satisfiable,
        total_daily_rate=total(chosen),
        gaps=[],
    )


def _gap_only(satisfiable: list[str], gap: Gap) -> Assembly:
    return Assembly(builders=[], covered_skills=satisfiable, total_daily_rate=0, gaps=[gap])


def _route_builder(
    builder_id: str, skills: dict[str, EligibleTuple], day_rate: int
) -> RouteBuilder:
    covers = cast(list[SkillId], sorted(skills))
    # One label per builder: never overclaim, so the weakest evidence across covered skills.
    weakest = min((skills[skill].evidence for skill in covers), key=lambda ev: EVIDENCE_RANK[ev])
    return RouteBuilder(
        builder_id=builder_id,
        name=display_name(builder_id),
        day_rate=day_rate,
        covers=covers,
        evidence_type=weakest,
        evidence_paths=[skills[skill].path for skill in covers],
    )
