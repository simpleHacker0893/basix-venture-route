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


# ---- partner-fit and cohort_of (#3) ----------------------------------------------------------


def test_partner_fit_health_brief_is_a_four_hop_chain(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    partners = engine.partner_candidates(briefs["brief-health-01"], ["amina-otieno"])

    assert [p.partner_id for p in partners] == ["amani-health"]
    partner = partners[0]
    assert partner.builder_id == "amina-otieno"
    assert partner.university_id == "omni-university"
    assert partner.cohort_id == "cohort-2026a"
    assert partner.path.rule == "partner-fit"
    assert partner.path.facts == [
        "(supports-vertical amani-health health)",
        "(partners-with amani-health omni-university)",
        "(cohort-of cohort-2026a omni-university)",
        "(belongs-to amina-otieno cohort-2026a)",
    ]


def test_partner_in_right_vertical_but_other_university_is_not_returned(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    # afya-plus supports health but partners with lakeside-university (D-07: four hops).
    partners = engine.partner_candidates(briefs["brief-health-01"], ["amina-otieno"])

    assert "afya-plus" not in {p.partner_id for p in partners}


def test_cohort_of_returns_cohort_and_university_with_path(engine: MettaRouteEngine) -> None:
    cohort = engine.cohort_of("amina-otieno")

    assert cohort is not None
    assert cohort.cohort_id == "cohort-2026a"
    assert cohort.university_id == "omni-university"
    assert cohort.path.facts == [
        "(belongs-to amina-otieno cohort-2026a)",
        "(cohort-of cohort-2026a omni-university)",
    ]
    assert engine.cohort_of("nobody") is None


# ---- reuse-fit (#4) --------------------------------------------------------------------------


def test_reuse_fit_health_brief_returns_licensable_health_asset(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    candidates = engine.reuse_candidates(briefs["brief-health-01"])

    assert [c.asset_id for c in candidates] == ["asset-afya-triage"]
    candidate = candidates[0]
    assert candidate.skill_ids == ["ai-metta", "python"]
    assert candidate.path.rule == "reuse-fit"
    assert "(licensable asset-afya-triage)" in candidate.path.facts
    assert "(vertical asset-afya-triage health)" in candidate.path.facts
    assert "(demonstrates asset-afya-triage python)" in candidate.path.facts


# ---- route-gap (#5) --------------------------------------------------------------------------


def test_route_gap_constrained_brief_skill_gap_for_mobile_only(
    engine: MettaRouteEngine, briefs: dict[str, VentureBrief]
) -> None:
    gaps = engine.gaps(briefs["brief-constrained-01"])

    assert [(g.category, g.affected) for g in gaps] == [("skill", ["mobile"])]
    assert gaps[0].rule == "route-gap"
    assert gaps[0].next_actions
    rust = [t for t in engine.eligible_builders(briefs["brief-constrained-01"])]
    assert [(t.builder_id, t.skill_id) for t in rust] == [("zawadi-njoroge", "rust")]
