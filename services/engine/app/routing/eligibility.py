"""Eligibility for one builder on one brief (Sprint 004, spec #52 §Eligibility; AGENTS.md rule 1).

One function over the engine's public seams and nothing else: the `eligible-builder` witnesses
from `eligible_builders(brief)` filtered to the builder id, and, when none matches, the reason
from `gaps(brief)`. No new MeTTa rule, no new engine method, no status check outside the graph:
an unconfirmed or rejected builder has no atoms (D-15) and simply matches nothing.

The reason is two-tier (chosen by the Operator, spec #52): the statement of the first `route-gap`
the founder's route carries, sorted by skill id, so the builder reads the sentence the founder
saw; otherwise the fixed template. The gap is the brief's, not the builder's: when the founder's
route has no gap, every ineligible builder reads the template.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.models.engine import ReasoningPath


@dataclass(frozen=True)
class BuilderEligibility:
    """`eligible` with the sorted skill ids `eligible-builder` held for and the first witness as
    `path`; or not eligible with a `reason`."""

    eligible: bool
    skills: list[str]
    path: ReasoningPath | None
    reason: str | None


def template_reason(builder_id: str, required_skills: list[str]) -> str:
    return (
        f"eligible-builder does not hold for {builder_id} on any of {', '.join(required_skills)}."
    )


def eligibility(
    engine: MettaRouteEngine, brief: VentureBrief, builder_id: str
) -> BuilderEligibility:
    matched = sorted(
        (t for t in engine.eligible_builders(brief) if t.builder_id == builder_id),
        key=lambda t: t.skill_id,
    )
    if matched:
        return BuilderEligibility(
            eligible=True,
            skills=[t.skill_id for t in matched],
            path=matched[0].path,
            reason=None,
        )
    gaps = sorted(engine.gaps(brief), key=lambda gap: gap.affected[0])
    reason = gaps[0].statement if gaps else template_reason(builder_id, list(brief.required_skills))
    return BuilderEligibility(eligible=False, skills=[], path=None, reason=reason)
