"""Marketplace wire contracts (spec #35 §Marketplace API). Mirrored by Zod in
`packages/contracts/src/marketplace.ts`; `scripts/export_schema.py --check` keeps them equal.

Aliases are camelCase on the wire like every Sprint 001 contract. One skill shape everywhere:
`{id, name, status: verified | self-described, evidence: credential | project | both | null}`.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.brief import PositiveSafeInt, SkillId

Evidence = Literal["credential", "project", "both"]
SkillStatus = Literal["verified", "self-described"]
AccountStatus = Literal["pending", "confirmed", "rejected"]
UserRole = Literal["founder", "builder"]

DisplayName = Annotated[str, Field(min_length=1, max_length=80)]
Headline = Annotated[str, Field(max_length=200)]
Location = Annotated[str, Field(min_length=1, max_length=100)]
ContactField = Annotated[str, Field(max_length=100)]
CohortId = Annotated[str, Field(min_length=1, max_length=40)]


class Wire(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class RoleChoice(Wire):
    role: UserRole


class RoleResponse(Wire):
    clerk_id: str = Field(alias="clerkId")
    role: UserRole
    confirmed: bool


class DeliveryModes(Wire):
    remote: bool
    hybrid: bool
    on_site: bool = Field(alias="onSite")

    @model_validator(mode="after")
    def _at_least_one(self) -> Self:
        if not (self.remote or self.hybrid or self.on_site):
            raise ValueError("choose at least one delivery mode")
        return self


class ContactSharing(Wire):
    email: bool
    phone: bool
    linkedin: bool


class AvailabilityRange(Wire):
    start: date
    end: date

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.end < self.start:
            raise ValueError("end must not be before start")
        return self


class ProfileInput(Wire):
    display_name: DisplayName = Field(alias="displayName")
    headline: Headline = ""
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    location: Location
    day_rate: PositiveSafeInt = Field(alias="dayRate")
    modes: DeliveryModes
    self_described_skills: list[SkillId] = Field(alias="selfDescribedSkills", max_length=9)
    phone: ContactField | None = None
    linkedin: ContactField | None = None
    sharing: ContactSharing
    availability: list[AvailabilityRange] = Field(max_length=12)

    @field_validator("display_name")
    @classmethod
    def _has_a_letter_or_digit(cls, value: str) -> str:
        if not any(char.isalnum() for char in value):
            raise ValueError("needs at least one letter or digit")
        return value.strip()


class ProfileSkill(Wire):
    id: SkillId
    name: str
    status: SkillStatus
    evidence: Evidence | None = None


class Contact(Wire):
    email: str
    phone: str | None = None
    linkedin: str | None = None


class BuilderProfile(Wire):
    builder_id: str = Field(alias="builderId")
    display_name: DisplayName = Field(alias="displayName")
    headline: Headline
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    location: Location
    day_rate: PositiveSafeInt = Field(alias="dayRate")
    modes: DeliveryModes
    self_described_skills: list[SkillId] = Field(alias="selfDescribedSkills")
    contact: Contact
    sharing: ContactSharing
    availability: list[AvailabilityRange]
    skills: list[ProfileSkill]
    account_status: AccountStatus = Field(alias="accountStatus")
    confirmed: bool
    demo_data: bool = Field(default=True, alias="demoData")
