"""VentureBrief: validated founder input (PRD §5.3, planning/DOMAIN.md "Core objects")."""

import json
import re
from datetime import date
from pathlib import Path
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Vertical = Literal["health", "agri", "education"]
DeliveryMode = Literal["remote", "hybrid", "on-site"]
SkillId = Literal[
    "python",
    "ai-metta",
    "ui-ux",
    "frontend",
    "backend",
    "domain-research",
    "mobile",
    "rust",
    "data",
]

# Stable kebab-case IDs (AGENTS.md §Conventions); the only shape spliced into MeTTa queries.
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class VentureBrief(BaseModel):
    """Wire shape is camelCase; Python attributes are snake_case."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str = Field(pattern=SLUG.pattern)
    title: str = Field(min_length=1, max_length=200)
    vertical: Vertical
    required_skills: list[SkillId] = Field(alias="requiredSkills", min_length=1)
    maximum_team_size: int = Field(alias="maximumTeamSize", ge=1, le=10)
    availability_start: date = Field(alias="availabilityStart")
    availability_end: date = Field(alias="availabilityEnd")
    delivery_mode: DeliveryMode = Field(alias="deliveryMode")
    location: str | None = Field(default=None, min_length=1, max_length=100)
    daily_budget: int = Field(alias="dailyBudget", gt=0)
    prefer_reusable_ip: bool = Field(alias="preferReusableIp")
    demo_data: bool = Field(default=True, alias="demoData")

    @model_validator(mode="after")
    def _check_window_and_location(self) -> Self:
        if self.availability_end < self.availability_start:
            raise ValueError("availabilityEnd must not precede availabilityStart")
        if self.delivery_mode == "on-site" and not self.location:
            raise ValueError("location is required when deliveryMode is on-site")
        if len(set(self.required_skills)) != len(self.required_skills):
            raise ValueError("requiredSkills must not repeat a skill")
        return self

    @property
    def location_id(self) -> str | None:
        """Location as the kebab-case symbol used by `located-in` facts."""
        if self.location is None:
            return None
        return re.sub(r"[^a-z0-9]+", "-", self.location.strip().lower()).strip("-")


def load_seed_briefs(path: Path) -> list[VentureBrief]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [VentureBrief.model_validate(item) for item in raw]
