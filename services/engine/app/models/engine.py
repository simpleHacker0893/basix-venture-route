"""Typed engine results consumed by Sprint 001 (blueprint "Interfaces").

Python attributes are snake_case; the wire shape is camelCase to match the Zod contracts in
`packages/contracts` (AGENTS.md §Stack) and the `nextActions[]` shape in DOMAIN.md.
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

EvidenceType = Literal["credential", "project", "both"]
GapCategory = Literal["skill", "availability", "mode", "location", "team-size", "budget"]


class RuleName(StrEnum):
    """The named rules from planning/DOMAIN.md. Seven MeTTa rules plus two assembler rules."""

    VERIFIED_FOR_SKILL = "verified-for-skill"
    MODE_COMPATIBLE = "mode-compatible"
    AVAILABLE_FOR_BRIEF = "available-for-brief"
    ELIGIBLE_BUILDER = "eligible-builder"
    REUSE_FIT = "reuse-fit"
    PARTNER_FIT = "partner-fit"
    ROUTE_GAP = "route-gap"
    ASSEMBLER_TEAM_SIZE_FIT = "assembler.team-size-fit"
    ASSEMBLER_BUDGET_FIT = "assembler.budget-fit"


class LookupName(StrEnum):
    """Graph predicates read directly for a reasoning path that no named rule produces."""

    COHORT_OF = "cohort-of"


# Named MeTTa rule -> number of arguments in its head, used to confirm each one is loaded.
METTA_RULE_ARITY: dict[RuleName, int] = {
    RuleName.VERIFIED_FOR_SKILL: 2,
    RuleName.MODE_COMPATIBLE: 2,
    RuleName.AVAILABLE_FOR_BRIEF: 2,
    RuleName.ELIGIBLE_BUILDER: 3,
    RuleName.REUSE_FIT: 2,
    RuleName.PARTNER_FIT: 2,
    RuleName.ROUTE_GAP: 3,
}


class EngineModel(BaseModel):
    model_config = ConfigDict(frozen=True, alias_generator=to_camel, populate_by_name=True)


class ReasoningPath(EngineModel):
    """{ rule, facts[], conclusion }: one per builder×skill, per IP, per cohort, per partner."""

    rule: RuleName | LookupName
    facts: list[str] = Field(description="Source facts as written in the space, in match order")
    conclusion: str


class EligibleTuple(EngineModel):
    builder_id: str
    skill_id: str
    evidence: EvidenceType
    path: ReasoningPath


class CohortInfo(EngineModel):
    builder_id: str
    cohort_id: str
    university_id: str
    path: ReasoningPath


class ReuseCandidate(EngineModel):
    asset_id: str
    skill_ids: list[str] = Field(description="Required skills the asset demonstrates")
    path: ReasoningPath


class PartnerCandidate(EngineModel):
    partner_id: str
    builder_id: str
    university_id: str
    cohort_id: str
    path: ReasoningPath


class Gap(EngineModel):
    category: GapCategory
    statement: str
    affected: list[str]
    next_actions: list[str]
    rule: RuleName
