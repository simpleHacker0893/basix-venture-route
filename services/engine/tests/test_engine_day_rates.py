"""Seam: MettaRouteEngine.day_rates over the real runtime (D-24; engine seams per D-19)."""

import pytest

from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine

pytestmark = pytest.mark.runtime


def test_day_rates_reads_seed_day_rate_atoms_for_the_requested_builders(
    engine: MettaRouteEngine,
) -> None:
    rates = engine.day_rates(["grace-wambui", "amina-otieno", "daniel-kiptoo"])

    assert rates == {"amina-otieno": 120, "daniel-kiptoo": 150, "grace-wambui": 100}


def test_day_rates_of_no_builders_is_empty(engine: MettaRouteEngine) -> None:
    assert engine.day_rates([]) == {}


def test_day_rates_unknown_builder_is_an_engine_error(engine: MettaRouteEngine) -> None:
    with pytest.raises(EngineError, match="nobody"):
        engine.day_rates(["nobody"])
