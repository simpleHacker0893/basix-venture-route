"""LlmAdapter protocol and the shapes that cross it (D-06; PRD §5.7 LLM boundary)."""

from __future__ import annotations

from datetime import date
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from app.models.brief import DeliveryMode, PositiveSafeInt, SkillId, TeamSize, Vertical
from app.models.chat import PartialBrief
from app.models.route import VentureRoute

# System instruction, verbatim from planning/DOMAIN.md §LLM boundary (must appear in code).
SYSTEM_INSTRUCTION = (
    "The routing engine is the source of truth for people, credentials, projects, availability, "
    "cost, cohorts, partners and gaps. Never select entities, invent evidence, or claim a route "
    "is verified unless the exact information appears in the engine result. If the route "
    "contains a gap, explain that gap and only the next actions supplied by the engine."
)


class LlmUnavailable(RuntimeError):
    """The provider timed out, errored, or is not configured; callers fall back to NullAdapter."""


class ExtractedBrief(BaseModel):
    """What intake may extract from a founder message: every field optional, nothing else.

    No `id` (the orchestrator assigns it) and no `demoData` (the server sets it).
    """

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    vertical: Vertical | None = None
    required_skills: list[SkillId] | None = Field(
        default=None, alias="requiredSkills", min_length=1
    )
    maximum_team_size: TeamSize | None = Field(default=None, alias="maximumTeamSize")
    availability_start: date | None = Field(default=None, alias="availabilityStart")
    availability_end: date | None = Field(default=None, alias="availabilityEnd")
    delivery_mode: DeliveryMode | None = Field(default=None, alias="deliveryMode")
    location: str | None = Field(default=None, min_length=1, max_length=100)
    daily_budget: PositiveSafeInt | None = Field(default=None, alias="dailyBudget")
    prefer_reusable_ip: bool | None = Field(default=None, alias="preferReusableIp")


class LlmAdapter(Protocol):
    name: str

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        """Brief fields stated in `message`; `current` is context only. Raises LlmUnavailable."""
        ...

    def explain_route(self, route: VentureRoute) -> str:
        """A summary of the structured route and nothing else. Raises LlmUnavailable."""
        ...

    def suggest_skills(self, text: str) -> list[str]:
        """Raw skill labels stated in pasted résumé text (D-50); the caller maps them to the
        vocabulary, dedupes and caps. `text` is never stored or logged, and no exception raised
        here may carry it. Raises LlmUnavailable."""
        ...
