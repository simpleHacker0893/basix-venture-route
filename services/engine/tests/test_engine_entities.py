"""Seam: MettaRouteEngine.known_entities over the real runtime (engine seams per D-19).

The explanation boundary needs the universe of entity ids so it can tell when an LLM summary
names something outside the route.
"""

import pytest

from app.engine.metta_engine import MettaRouteEngine

pytestmark = pytest.mark.runtime


def test_known_entities_cover_builders_assets_partners_cohorts_and_universities(
    engine: MettaRouteEngine,
) -> None:
    known = engine.known_entities()

    assert {"amina-otieno", "hassan-abdi", "mercy-akinyi"} <= known
    assert {"asset-afya-triage", "asset-clinic-dash"} <= known
    assert {"amani-health", "afya-plus"} <= known
    assert {"cohort-2026a", "omni-university"} <= known
    assert "python" not in known
    assert "health" not in known
