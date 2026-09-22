"""Typed engine results consumed by Sprint 001 (blueprint "Interfaces")."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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


METTA_RULES: tuple[RuleName, ...] = (
    RuleName.VERIFIED_FOR_SKILL,
    RuleName.MODE_COMPATIBLE,
    RuleName.AVAILABLE_FOR_BRIEF,
    RuleName.ELIGIBLE_BUILDER,
    RuleName.REUSE_FIT,
    RuleName.PARTNER_FIT,
    RuleName.ROUTE_GAP,
)


class ReasoningPath(BaseModel):
    """{ rule, facts[], conclusion }: one per builder×skill, per IP, per cohort, per partner."""

    model_config = ConfigDict(frozen=True)

    rule: RuleName
    facts: list[str] = Field(description="Source facts as written in the space, in match order")
    conclusion: str


class EligibleTuple(BaseModel):
    model_config = ConfigDict(frozen=True)

    builder_id: str
    skill_id: str
    evidence: EvidenceType
    path: ReasoningPath


class CohortInfo(BaseModel):
    model_config = ConfigDict(frozen=True)

    builder_id: str
    cohort_id: str
    university_id: str
    path: ReasoningPath


class ReuseCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    asset_id: str
    skill_ids: list[str] = Field(description="Required skills the asset demonstrates")
    path: ReasoningPath


class PartnerCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    partner_id: str
    builder_id: str
    university_id: str
    cohort_id: str
    path: ReasoningPath


class Gap(BaseModel):
    model_config = ConfigDict(frozen=True)

    category: GapCategory
    statement: str
    affected: list[str]
    next_actions: list[str]
    rule: RuleName
