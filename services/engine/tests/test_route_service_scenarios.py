"""Route service over the real runtime: engine -> assembler -> VentureRoute (Sprint 001, #13).

Expected values are the exact DOMAIN.md §Demo scenarios (D-22, D-23). The same scenarios are
repeated over HTTP in test_scenarios_api.py (#18).
"""

import pytest

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.routing.route_service import RouteService

pytestmark = pytest.mark.runtime


@pytest.fixture(scope="module")
def service(engine: MettaRouteEngine) -> RouteService:
    return RouteService(engine)


def test_health_pilot_is_feasible_with_the_exact_team_ip_cohort_and_partner(
    service: RouteService, briefs: dict[str, VentureBrief]
) -> None:
    route = service.route(briefs["brief-health-01"])

    assert route.status == "feasible"
    assert [(b.builder_id, b.evidence_type) for b in route.builders] == [
        ("amina-otieno", "both"),
        ("daniel-kiptoo", "both"),
        ("grace-wambui", "credential"),
    ]
    assert route.total_daily_rate == 370
    assert route.reusable_ip is not None
    assert route.reusable_ip.asset_id == "asset-afya-triage"
    assert route.reusable_ip.path.rule == "reuse-fit"
    assert route.cohort is not None
    assert (route.cohort.cohort_id, route.cohort.university_id) == (
        "cohort-2026a",
        "omni-university",
    )
    assert route.cohort.path.facts[0] == "(belongs-to amina-otieno cohort-2026a)"
    assert route.partner is not None
    assert route.partner.partner_id == "amani-health"
    assert route.partner.path.rule == "partner-fit"
    assert len(route.partner.path.facts) == 4
    assert route.gaps == []
    assert route.rules_applied == ["cohort-of", "eligible-builder", "partner-fit", "reuse-fit"]
    assert route.summary


def test_agri_marketplace_is_feasible_and_cost_ordering_beats_evidence(
    service: RouteService, briefs: dict[str, VentureBrief]
) -> None:
    route = service.route(briefs["brief-agri-01"])

    assert route.status == "feasible"
    assert sorted(b.builder_id for b in route.builders) == [
        "fatuma-hassan",
        "lucy-achieng",
        "wanjiru-mwangi",
    ]
    assert "brian-odhiambo" not in {b.builder_id for b in route.builders}
    assert route.total_daily_rate == 315
    assert route.reusable_ip is not None
    assert route.reusable_ip.asset_id == "asset-shamba-records"
    assert route.partner is not None
    assert route.partner.partner_id == "shamba-agri"


def test_constrained_brief_is_partial_with_one_skill_gap_and_no_fabricated_builder(
    service: RouteService, briefs: dict[str, VentureBrief]
) -> None:
    route = service.route(briefs["brief-constrained-01"])

    assert route.status == "partial"
    assert [(g.category, g.affected, g.rule) for g in route.gaps] == [
        ("skill", ["mobile"], "route-gap")
    ]
    assert [(b.builder_id, b.covers, b.evidence_type) for b in route.builders] == [
        ("zawadi-njoroge", ["rust"], "credential")
    ]
    assert route.total_daily_rate == 130
    assert route.reusable_ip is None
    assert route.partner is None
    assert "route-gap" in route.rules_applied


def test_budget_challenge_is_partial_with_the_d22_budget_gap(
    service: RouteService, briefs: dict[str, VentureBrief]
) -> None:
    route = service.route(briefs["brief-budget-01"])

    assert route.status == "partial"
    assert route.builders == []
    assert route.total_daily_rate == 0
    assert len(route.gaps) == 1
    gap = route.gaps[0]
    assert (gap.category, gap.rule) == ("budget", "assembler.budget-fit")
    assert gap.affected == ["amina-otieno", "daniel-kiptoo", "grace-wambui"]
    assert "370" in gap.statement and "250" in gap.statement
    assert gap.next_actions == ["Raise daily budget to USD 370"]
    assert route.cohort is None
    assert route.partner is None


def test_delivery_mode_challenge_is_infeasible_with_three_location_gaps(
    service: RouteService, briefs: dict[str, VentureBrief]
) -> None:
    route = service.route(briefs["brief-onsite-01"])

    assert route.status == "infeasible"
    assert route.builders == []
    assert sorted((g.category, g.affected[0], g.rule) for g in route.gaps) == [
        ("location", "ai-metta", "route-gap"),
        ("location", "python", "route-gap"),
        ("location", "ui-ux", "route-gap"),
    ]
    assert route.reusable_ip is None
    assert route.cohort is None
    assert route.partner is None
    assert route.rules_applied == ["route-gap"]
