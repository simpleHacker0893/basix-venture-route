"""RouteService: validated brief -> VentureRoute, no HTTP, no LLM.

Every fact comes through a MettaRouteEngine method (eligible_builders, gaps, day_rates,
reuse_candidates, cohort_of, partner_candidates); this module never touches the space.
Status is a pure function of the gap set and coverage (D-09). Shapes follow D-22 and D-23.
"""

from __future__ import annotations

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.models.engine import EligibleTuple, Gap
from app.models.route import (
    ReusableIp,
    RouteBuilder,
    RouteCohort,
    RoutePartner,
    RouteStatus,
    VentureRoute,
)
from app.routing.assembler import Assembly, assemble
from app.routing.presenter import asset_title
from app.routing.summary import template_summary


def status_for(
    required_skills: list[str],
    eligible: list[EligibleTuple],
    assembly: Assembly,
    gaps: list[Gap],
) -> RouteStatus:
    """D-09: all skills covered and a team survives -> feasible; no eligible builder for any
    required skill -> infeasible; some skill covered or any gap -> partial."""
    if not eligible:
        return "infeasible"
    all_covered = set(assembly.covered_skills) == set(required_skills)
    if all_covered and assembly.builders and not gaps:
        return "feasible"
    return "partial"


class RouteService:
    def __init__(self, engine: MettaRouteEngine) -> None:
        self._engine = engine

    def route(self, brief: VentureBrief) -> VentureRoute:
        engine = self._engine
        eligible = engine.eligible_builders(brief)
        engine_gaps = engine.gaps(brief)
        rates = engine.day_rates(sorted({t.builder_id for t in eligible}))
        assembly = assemble(eligible, rates, brief)
        gaps = [*engine_gaps, *assembly.gaps]
        status = status_for(list(brief.required_skills), eligible, assembly, gaps)

        reusable_ip: ReusableIp | None = None
        cohort: RouteCohort | None = None
        partner: RoutePartner | None = None
        if status != "infeasible":
            reusable_ip = self._reusable_ip(brief)
            if assembly.builders:
                first = assembly.builders[0].builder_id
                cohort = self._cohort(first)
                partner = self._partner(brief, first)

        route = VentureRoute(
            status=status,
            builders=assembly.builders,
            total_daily_rate=assembly.total_daily_rate,
            reusable_ip=reusable_ip,
            cohort=cohort,
            partner=partner,
            gaps=gaps,
            rules_applied=_rules_applied(assembly.builders, reusable_ip, cohort, partner, gaps),
            summary="",
        )
        return route.model_copy(update={"summary": template_summary(route)})

    def _reusable_ip(self, brief: VentureBrief) -> ReusableIp | None:
        """First `reuse-fit` candidate in stable asset-id order, only when the brief prefers IP."""
        if not brief.prefer_reusable_ip:
            return None
        candidates = self._engine.reuse_candidates(brief)
        if not candidates:
            return None
        chosen = candidates[0]
        return ReusableIp(
            asset_id=chosen.asset_id, title=asset_title(chosen.asset_id), path=chosen.path
        )

    def _cohort(self, builder_id: str) -> RouteCohort | None:
        info = self._engine.cohort_of(builder_id)
        if info is None:
            return None
        return RouteCohort(
            cohort_id=info.cohort_id, university_id=info.university_id, path=info.path
        )

    def _partner(self, brief: VentureBrief, builder_id: str) -> RoutePartner | None:
        """The `partner-fit` candidate of the first selected builder (D-23), stable order."""
        candidates = self._engine.partner_candidates(brief, [builder_id])
        if not candidates:
            return None
        return RoutePartner(partner_id=candidates[0].partner_id, path=candidates[0].path)


def _rules_applied(
    builders: list[RouteBuilder],
    reusable_ip: ReusableIp | None,
    cohort: RouteCohort | None,
    partner: RoutePartner | None,
    gaps: list[Gap],
) -> list[str]:
    """Sorted set of rule names present in any reasoning path or gap."""
    names = {str(path.rule) for builder in builders for path in builder.evidence_paths}
    for section in (reusable_ip, cohort, partner):
        if section is not None:
            names.add(str(section.path.rule))
    names.update(str(gap.rule) for gap in gaps)
    return sorted(names)
