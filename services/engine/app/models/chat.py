"""ChatTurn and ChatResponse: the conversation seam (PRD §5.2).

Mirrors `packages/contracts/src/chat.ts`. `ChatResponse` is a discriminated union on `type`:
exactly one of clarification, route or validation-error comes back from POST /api/conversation.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.brief import (
    SLUG,
    DeliveryMode,
    PositiveSafeInt,
    SkillId,
    TeamSize,
    VentureBrief,
    Vertical,
)
from app.models.route import VentureRoute

# keyof VentureBrief on the wire (PRD §5.3 field names).
BriefField = Literal[
    "id",
    "title",
    "vertical",
    "requiredSkills",
    "maximumTeamSize",
    "availabilityStart",
    "availabilityEnd",
    "deliveryMode",
    "location",
    "dailyBudget",
    "preferReusableIp",
]

MAX_MESSAGE_LENGTH = 4000


class PartialBrief(BaseModel):
    """Partial<VentureBrief> (PRD §5.2): every field optional; `null` and absent both mean unknown.

    Carries `demoData` too, so a brief from `GET /api/scenarios` round-trips as `currentBrief`.
    """

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str | None = Field(default=None, pattern=SLUG.pattern)
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
    demo_data: bool | None = Field(default=None, alias="demoData")


class ChatTurn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    user_message: str = Field(alias="userMessage", max_length=MAX_MESSAGE_LENGTH)
    current_brief: PartialBrief | None = Field(default=None, alias="currentBrief")


class ChatResponseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ClarificationResponse(ChatResponseModel):
    type: Literal["clarification"]
    missing_fields: list[BriefField] = Field(alias="missingFields")
    message: str
    partial_brief: PartialBrief = Field(alias="partialBrief")


class RouteResponse(ChatResponseModel):
    type: Literal["route"]
    brief: VentureBrief
    route: VentureRoute
    message: str


class ValidationErrorResponse(ChatResponseModel):
    type: Literal["validation-error"]
    message: str


ChatResponse = Annotated[
    ClarificationResponse | RouteResponse | ValidationErrorResponse,
    Field(discriminator="type"),
]
