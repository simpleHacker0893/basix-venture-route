"""Marketplace wire contracts (spec #35 §Marketplace API). Mirrored by Zod in
`packages/contracts/src/marketplace.ts`; `scripts/export_schema.py --check` keeps them equal.

Aliases are camelCase on the wire like every Sprint 001 contract. One skill shape everywhere:
`{id, name, status: verified | self-described, evidence: credential | project | both | null}`.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SerializerFunctionWrapHandler,
    field_validator,
    model_serializer,
    model_validator,
)

from app.models.brief import JS_SAFE_INT, PositiveSafeInt, SkillId, Vertical

Evidence = Literal["credential", "project", "both"]
SkillStatus = Literal["verified", "self-described"]
AccountStatus = Literal["pending", "confirmed", "rejected"]
UserRole = Literal["founder", "builder"]

DisplayName = Annotated[str, Field(min_length=1, max_length=80)]
Headline = Annotated[str, Field(max_length=200)]
Location = Annotated[str, Field(min_length=1, max_length=100)]
ContactField = Annotated[str, Field(max_length=100)]
CohortId = Annotated[str, Field(min_length=1, max_length=40)]
Title = Annotated[str, Field(min_length=1, max_length=120)]
Issuer = Annotated[str, Field(min_length=1, max_length=120)]


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


# -- proof: credentials and projects (pending until an admin confirms them, #42) -------------------


class CredentialInput(Wire):
    title: Title
    issuer: Issuer
    skill_id: SkillId = Field(alias="skillId")


class CredentialOut(Wire):
    id: str
    title: Title
    issuer: Issuer
    skill_id: SkillId = Field(alias="skillId")
    status: AccountStatus
    demo_data: bool = Field(default=True, alias="demoData")


class ProjectInput(Wire):
    title: Title
    vertical: Vertical
    licensable: bool
    completed_on: date = Field(alias="completedOn")
    skill_ids: list[SkillId] = Field(alias="skillIds", min_length=1, max_length=5)


class ProjectOut(Wire):
    id: str
    title: Title
    vertical: Vertical
    licensable: bool
    completed_on: date = Field(alias="completedOn")
    skill_ids: list[SkillId] = Field(alias="skillIds", min_length=1, max_length=5)
    status: AccountStatus
    demo_data: bool = Field(default=True, alias="demoData")


# -- admin queue (spec #35 §Admin) ---------------------------------------------------------


class PendingAccount(Wire):
    id: str
    clerk_id: str = Field(alias="clerkId")
    email: str
    role: UserRole | None = None
    builder_id: str | None = Field(default=None, alias="builderId")
    display_name: str | None = Field(default=None, alias="displayName")
    cohort_id: str | None = Field(default=None, alias="cohortId")
    submitted_at: datetime = Field(alias="submittedAt")
    demo_data: bool = Field(default=True, alias="demoData")


class PendingCredential(Wire):
    id: str
    builder_id: str = Field(alias="builderId")
    display_name: str = Field(alias="displayName")
    title: Title
    issuer: Issuer
    skill_id: SkillId = Field(alias="skillId")
    submitted_at: datetime = Field(alias="submittedAt")
    demo_data: bool = Field(default=True, alias="demoData")


class PendingProject(Wire):
    id: str
    builder_id: str = Field(alias="builderId")
    display_name: str = Field(alias="displayName")
    title: Title
    vertical: Vertical
    licensable: bool
    completed_on: date = Field(alias="completedOn")
    skill_ids: list[SkillId] = Field(alias="skillIds")
    submitted_at: datetime = Field(alias="submittedAt")
    demo_data: bool = Field(default=True, alias="demoData")


class PendingQueue(Wire):
    accounts: list[PendingAccount]
    credentials: list[PendingCredential]
    projects: list[PendingProject]


class AdminDecision(Wire):
    id: str
    kind: Literal["account", "credential", "project"]
    status: Literal["confirmed", "rejected"]
    projected_rows: int = Field(alias="projectedRows", ge=0, le=JS_SAFE_INT)


# -- candidate view (spec #35 §Marketplace API, #43) ---------------------------------------------


class SharedContact(Wire):
    """Only the contact keys whose sharing toggle is on; an unshared key is absent, never null."""

    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None

    @model_serializer(mode="wrap")
    def _drop_unshared(self, handler: SerializerFunctionWrapHandler) -> dict[str, str]:
        serialized: dict[str, str | None] = handler(self)
        return {key: value for key, value in serialized.items() if value is not None}


class Candidate(Wire):
    """A confirmed builder as a founder or admin sees them: proof only when confirmed."""

    builder_id: str = Field(alias="builderId")
    display_name: DisplayName = Field(alias="displayName")
    headline: Headline
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    location: Location
    day_rate: PositiveSafeInt = Field(alias="dayRate")
    modes: DeliveryModes
    availability: list[AvailabilityRange]
    skills: list[ProfileSkill]
    projects: list[ProjectOut]
    contact: SharedContact
    confirmed: bool
    demo_data: bool = Field(default=True, alias="demoData")
