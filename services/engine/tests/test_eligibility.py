"""Seam: `RouteService.eligibility(brief, builder_id)` over the real runtime (Sprint 004, #56;
D-19 seam "MettaRouteEngine methods and the route service").

Spec #52 §Eligibility: one function built from `eligible_builders` and `gaps` only, never a new
matcher (AGENTS.md rule 1). The reason is two-tier: the statement of the first `route-gap` the
founder's route carries, sorted by skill id, else the fixed template. Expected values come from
the seed (DOMAIN.md §Demo scenarios) and the shared cast: the confirmed Naomi Chebet is verified
for `mobile` only and available 2026-09-22 to 2026-10-20 remote.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.routing.eligibility import eligibility, template_reason
from app.routing.route_service import RouteService
from tests.conftest import Actor

pytestmark = pytest.mark.anyio

CONSTRAINED = "brief-constrained-01"
HEALTH = "brief-health-01"


def _november(brief: VentureBrief) -> VentureBrief:
    """The same brief with a window nobody in the seed or the cast is available for."""
    return brief.model_copy(
        update={
            "availability_start": date(2026, 11, 2),
            "availability_end": date(2026, 11, 9),
        }
    )


# -- eligible: the confirmed cast builder on the Constrained brief ------------------------------


async def test_confirmed_builder_is_eligible_with_the_eligible_builder_path(
    api: AsyncClient,
    confirmed_builder: Actor,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    verdict = eligibility(engine, briefs[CONSTRAINED], "naomi-chebet")

    assert verdict.eligible is True
    assert verdict.skills == ["mobile"]
    assert verdict.reason is None
    assert verdict.path is not None
    assert verdict.path.rule == "eligible-builder"
    assert "(confirmed admin-basix naomi-chebet)" in verdict.path.facts
    assert verdict.path.conclusion == "naomi-chebet is eligible for mobile with both evidence"


async def test_skills_are_sorted_and_the_path_is_the_first_witness(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    """amina-otieno is verified for python and ai-metta on the Health brief (seed)."""
    verdict = eligibility(engine, briefs[HEALTH], "amina-otieno")

    assert verdict.eligible is True
    assert verdict.skills == sorted(verdict.skills)
    assert verdict.path is not None
    assert verdict.path.rule == "eligible-builder"
    assert verdict.skills[0] in verdict.path.conclusion


# -- not eligible: the two-tier reason -----------------------------------------------------------


async def test_unconfirmed_builder_gets_the_template_reason_when_the_route_has_no_gap(
    api: AsyncClient,
    confirmed_builder: Actor,
    pending_builder: Actor,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    """With Naomi confirmed the Constrained route has no gap, so a builder with no atoms reads
    the template, not a founder's sentence."""
    brief = briefs[CONSTRAINED]
    assert RouteService(engine).route(brief).gaps == []
    assert pending_builder.builder_id == "ali-hassan"

    verdict = eligibility(engine, brief, "ali-hassan")

    assert verdict.eligible is False
    assert verdict.skills == []
    assert verdict.path is None
    assert verdict.reason == "eligible-builder does not hold for ali-hassan on any of mobile, rust."
    assert verdict.reason == template_reason("ali-hassan", ["mobile", "rust"])


async def test_verified_but_unavailable_builder_reads_the_founders_gap_statement(
    api: AsyncClient,
    confirmed_builder: Actor,
    engine: MettaRouteEngine,
    briefs: dict[str, VentureBrief],
) -> None:
    brief = _november(briefs[CONSTRAINED])
    route = RouteService(engine).route(brief)
    assert [(g.category, g.affected) for g in route.gaps] == [
        ("availability", ["mobile"]),
        ("availability", ["rust"]),
    ]

    verdict = eligibility(engine, brief, "naomi-chebet")

    assert verdict.eligible is False
    assert verdict.reason == route.gaps[0].statement


async def test_unknown_builder_reads_the_skill_gap_the_founder_saw(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    """Seed only: nobody is verified for mobile, so the Constrained route carries a skill gap."""
    route = RouteService(engine).route(briefs[CONSTRAINED])
    assert route.gaps[0].category == "skill"

    verdict = eligibility(engine, briefs[CONSTRAINED], "naomi-chebet")

    assert verdict.eligible is False
    assert verdict.reason == route.gaps[0].statement


async def test_seed_builder_verified_but_unavailable_on_a_gapless_route_reads_the_template(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    """juma-kariuki: python verified by project, available 2026-10-05 to 2026-10-19 only."""
    assert RouteService(engine).route(briefs[HEALTH]).gaps == []

    verdict = eligibility(engine, briefs[HEALTH], "juma-kariuki")

    assert verdict.eligible is False
    assert verdict.reason == template_reason("juma-kariuki", ["python", "ai-metta", "ui-ux"])


# -- pure over the engine, exposed on the route service ------------------------------------------


async def test_eligibility_never_writes_to_the_space(
    client_health: dict[str, int], engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    before = (engine.facts_loaded, engine.rules_loaded, engine.projected_rows)

    for builder_id in ("amina-otieno", "juma-kariuki", "nobody"):
        eligibility(engine, briefs[HEALTH], builder_id)
        eligibility(engine, _november(briefs[CONSTRAINED]), builder_id)

    assert (engine.facts_loaded, engine.rules_loaded, engine.projected_rows) == before
    assert client_health["rules_loaded"] == before[1] == 7


async def test_route_service_exposes_eligibility(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    service = RouteService(engine)

    assert service.eligibility(briefs[HEALTH], "amina-otieno") == eligibility(
        engine, briefs[HEALTH], "amina-otieno"
    )
    assert service.eligibility(briefs[HEALTH], "nobody") == eligibility(
        engine, briefs[HEALTH], "nobody"
    )


@pytest.fixture
def client_health(engine: MettaRouteEngine) -> dict[str, int]:
    """`GET /health` of the seed-only app, for the rule count the judge reads."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(engine=engine, session_factory=None)) as client:
        body: dict[str, int] = client.get("/health").json()
        return body
