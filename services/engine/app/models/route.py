"""VentureRoute: the engine's answer to a brief (PRD §5.4, planning/DOMAIN.md "Route").

Mirrors `packages/contracts/src/route.ts`; the parity test proves the two JSON Schemas are equal.
Money is integer USD per day (D-16). `status` is a plain enum field set by the route service
(D-09); there is no proposed-status or status-source field.
"""

from typing import Literal

from app.models.brief import SafeInt, SkillId
from app.models.engine import EngineModel, EvidenceType, Gap, ReasoningPath

RouteStatus = Literal["feasible", "partial", "infeasible"]


class RouteBuilder(EngineModel):
    builder_id: str
    name: str
    day_rate: SafeInt
    covers: list[SkillId]
    evidence_type: EvidenceType
    evidence_paths: list[ReasoningPath]


class ReusableIp(EngineModel):
    asset_id: str
    title: str
    path: ReasoningPath


class RouteCohort(EngineModel):
    cohort_id: str
    university_id: str
    path: ReasoningPath


class RoutePartner(EngineModel):
    partner_id: str
    path: ReasoningPath


class VentureRoute(EngineModel):
    status: RouteStatus
    builders: list[RouteBuilder]
    total_daily_rate: SafeInt
    reusable_ip: ReusableIp | None = None
    cohort: RouteCohort | None = None
    partner: RoutePartner | None = None
    gaps: list[Gap]
    rules_applied: list[str]
    summary: str
