"""Rule semantics on the real runtime (blueprint step 9). Same seams as the contract test."""

import pytest

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief

pytestmark = pytest.mark.runtime


def _brief(**overrides: object) -> VentureBrief:
    base: dict[str, object] = {
        "id": "brief-test",
        "title": "semantics probe",
        "vertical": "agri",
        "requiredSkills": ["backend"],
        "maximumTeamSize": 2,
        "availabilityStart": "2026-09-22",
        "availabilityEnd": "2026-09-29",
        "deliveryMode": "remote",
        "dailyBudget": 300,
        "preferReusableIp": False,
    }
    base.update(overrides)
    return VentureBrief.model_validate(base)


def _eligible_ids(engine: MettaRouteEngine, brief: VentureBrief) -> set[str]:
    return {t.builder_id for t in engine.eligible_builders(brief)}


class TestAvailableForBrief:
    """D-08: a builder qualifies at >= MIN_OVERLAP_DAYS (2) inclusive calendar days."""

    def test_one_day_overlap_is_not_available(self, engine: MettaRouteEngine) -> None:
        # samuel-kimani is available 2026-09-29 -> 2026-10-05: shares only 2026-09-29.
        assert "samuel-kimani" not in _eligible_ids(engine, _brief())

    def test_two_day_overlap_is_available(self, engine: MettaRouteEngine) -> None:
        # lucy-achieng is available 2026-09-28 -> 2026-10-05: shares 09-28 and 09-29.
        assert "lucy-achieng" in _eligible_ids(engine, _brief())


class TestModeCompatible:
    """requirements.md: hybrid accepts remote and hybrid supporters; on-site needs on-site
    plus a location match. Reading recorded here: remote accepts remote and hybrid supporters."""

    def test_hybrid_brief_accepts_remote_only_builder(self, engine: MettaRouteEngine) -> None:
        # brian-odhiambo supports remote only.
        assert "brian-odhiambo" in _eligible_ids(engine, _brief(deliveryMode="hybrid"))

    def test_remote_brief_accepts_hybrid_supporter(self, engine: MettaRouteEngine) -> None:
        # lucy-achieng supports remote and hybrid.
        assert "lucy-achieng" in _eligible_ids(engine, _brief())

    def test_remote_brief_rejects_on_site_only_builder(self, engine: MettaRouteEngine) -> None:
        # peter-omondi (data) supports on-site only.
        assert "peter-omondi" not in _eligible_ids(engine, _brief(requiredSkills=["data"]))

    def test_on_site_requires_matching_location(self, engine: MettaRouteEngine) -> None:
        on_site_nairobi = _brief(
            requiredSkills=["python"], deliveryMode="on-site", location="Nairobi"
        )
        on_site_kisumu = _brief(
            requiredSkills=["python"], deliveryMode="on-site", location="Kisumu"
        )

        assert "amina-otieno" in _eligible_ids(engine, on_site_nairobi)
        assert "amina-otieno" not in _eligible_ids(engine, on_site_kisumu)
