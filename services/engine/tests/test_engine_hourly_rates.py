"""Seam: MettaRouteEngine.hourly_rates over the real runtime (D-24, D-59; seams per D-19)."""

import pytest

from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine

pytestmark = pytest.mark.runtime


def test_hourly_rates_reads_seed_hourly_rate_atoms_for_the_requested_builders(
    engine: MettaRouteEngine,
) -> None:
    rates = engine.hourly_rates(["grace-wambui", "amina-otieno", "daniel-kiptoo"])

    assert rates == {"amina-otieno": 15, "daniel-kiptoo": 19, "grace-wambui": 13}


def test_hourly_rates_of_no_builders_is_empty(engine: MettaRouteEngine) -> None:
    assert engine.hourly_rates([]) == {}


def test_hourly_rates_unknown_builder_is_an_engine_error(engine: MettaRouteEngine) -> None:
    with pytest.raises(EngineError, match="nobody"):
        engine.hourly_rates(["nobody"])
