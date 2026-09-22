"""Real-runtime contract test (requirements.md item 6).

Seams (D-19): MettaRouteEngine.eligible_builders / reuse_candidates / partner_candidates /
cohort_of / gaps against the real Hyperon runtime. No mocks. Fails, never skips, without hyperon.
"""

import pytest

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief

pytestmark = pytest.mark.runtime


def test_hyperon_is_installed() -> None:
    import hyperon

    assert hyperon.MeTTa


def test_eligible_builders_health_brief_amina_python_both(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    tuples = engine.eligible_builders(briefs["brief-health-01"])

    amina = [t for t in tuples if t.builder_id == "amina-otieno" and t.skill_id == "python"]
    assert len(amina) == 1
    assert amina[0].evidence == "both"
    path = amina[0].path
    assert path.rule == "eligible-builder"
    assert "(earned amina-otieno cred-py-201)" in path.facts
    assert "(proves cred-py-201 python)" in path.facts
    assert "(confirmed admin-basix cred-py-201)" in path.facts
    assert "(built amina-otieno proj-afya-bot)" in path.facts
    assert "(demonstrates proj-afya-bot python)" in path.facts
    assert "(confirmed admin-basix proj-afya-bot)" in path.facts
    assert "(confirmed admin-basix amina-otieno)" in path.facts


def test_health_brief_covers_every_required_skill_once(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    tuples = engine.eligible_builders(briefs["brief-health-01"])

    assert sorted((t.builder_id, t.skill_id, t.evidence) for t in tuples) == [
        ("amina-otieno", "python", "both"),
        ("daniel-kiptoo", "ai-metta", "both"),
        ("grace-wambui", "ui-ux", "credential"),
    ]


def test_self_described_skill_never_makes_a_builder_eligible(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    tuples = engine.eligible_builders(briefs["brief-health-01"])

    builders = {t.builder_id for t in tuples}
    assert "hassan-abdi" not in builders  # only has-self-described-skill for python
    assert "kevin-mutua" not in builders  # ui-ux credential exists but is not confirmed
    assert not any(t.builder_id == "amina-otieno" and t.skill_id == "ai-metta" for t in tuples)


def test_unconfirmed_account_is_never_eligible(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    tuples = engine.eligible_builders(briefs["brief-agri-01"])

    assert "mercy-akinyi" not in {t.builder_id for t in tuples}
    assert ("wanjiru-mwangi", "frontend") in {(t.builder_id, t.skill_id) for t in tuples}
