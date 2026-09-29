"""Marketplace wire contracts (spec #35 §Marketplace API). Mirrored by Zod in
`packages/contracts/src/marketplace.ts`; `scripts/export_schema.py --check` keeps them equal.

Aliases are camelCase on the wire like every Sprint 001 contract. One skill shape everywhere:
`{id, name, status: verified | self-described, evidence: credential | project | both | null}`.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    SerializerFunctionWrapHandler,
    StringConstraints,
    ValidationInfo,
    field_validator,
    model_serializer,
    model_validator,
)

from app.models.brief import (
    JS_SAFE_INT,
    DeliveryMode,
    PositiveSafeInt,
    SafeInt,
    SkillId,
    VentureBrief,
    Vertical,
)
from app.models.engine import ReasoningPath
from app.models.route import RouteStatus

Evidence = Literal["credential", "project", "both"]
SkillStatus = Literal["verified", "self-described"]
AccountStatus = Literal["pending", "confirmed", "rejected"]
UserRole = Literal["founder", "builder"]
# Sprint 005a (spec #86): a showcase entry's own review status, and which kind of skill a
# `GET /api/showcase?skill=` filter matched. Declared up here so the admin queue row shapes below
# (`PendingShowcase`/`DecidedShowcase`) can use `ShowcaseStatus` before its own section.
MatchedSkillKind = Literal["demonstrated", "verified", "self-described"]
ShowcaseStatus = Literal["none", "pending", "confirmed", "rejected"]

DisplayName = Annotated[str, Field(min_length=1, max_length=80)]
Headline = Annotated[str, Field(max_length=200)]
Location = Annotated[str, Field(min_length=1, max_length=100)]
ContactField = Annotated[str, Field(max_length=100)]
CohortId = Annotated[str, Field(min_length=1, max_length=40)]
Title = Annotated[str, Field(min_length=1, max_length=120)]
Issuer = Annotated[str, Field(min_length=1, max_length=120)]

# Sprint 005a (spec #86, D-43/D-52): showcase description, plain link strings (the `https://` /
# host / YouTube rules live in `app/marketplace/links.py`, enforced by the endpoints, not here),
# one free-text skill label shared by `skillSet`, `suggestedSkills` and résumé suggestions
# (`strip_whitespace=True` rejects a whitespace-only entry outright, since it strips to ""
# before the `min_length` check runs), and the 11-character YouTube video id the endpoints parse
# out of `pitchVideoUrl` (#89).
ShowcaseDescription = Annotated[str, Field(max_length=1000)]
ShowcaseUrl = Annotated[str, Field(max_length=500)]
SkillSetEntry = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
]
PitchVideoId = Annotated[str, Field(min_length=11, max_length=11)]


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
    # Sprint 005a (spec #86, D-43/D-52): free-text skill chips, separate from the nine-skill
    # `selfDescribedSkills` above, which stays unchanged. `skillSet` is picked by hand;
    # `suggestedSkills` holds résumé chips the builder accepted one at a time (D-50).
    # `default=[]` is safe here: Pydantic v2 deep-copies mutable Field defaults per instance, and
    # (unlike `default_factory`) a literal default shows up in the JSON Schema like Zod's
    # `.default([])`, so the two sides stay in parity.
    skill_set: list[SkillSetEntry] = Field(default=[], alias="skillSet", max_length=20)
    suggested_skills: list[SkillSetEntry] = Field(
        default=[], alias="suggestedSkills", max_length=20
    )
    # Public profile links, shown on the Showcase regardless of the `sharing` toggle above.
    github_url: ShowcaseUrl | None = Field(default=None, alias="githubUrl")
    linkedin_url: ShowcaseUrl | None = Field(default=None, alias="linkedinUrl")

    @field_validator("display_name")
    @classmethod
    def _has_a_letter_or_digit(cls, value: str) -> str:
        if not any(char.isalnum() for char in value):
            raise ValueError("needs at least one letter or digit")
        return value.strip()

    # `SkillSetEntry` already strips whitespace and rejects a now-empty entry, so only the
    # cross-entry rules (uniqueness, the combined 20-entry cap) need a validator here. Each is a
    # `field_validator`, not a `model_validator`, so a 422 names the field that actually caused it
    # (`skillSet` for a duplicate inside `skillSet` itself; `suggestedSkills` for the combined
    # 20-entry overflow or a duplicate `suggestedSkills` introduces).
    @field_validator("skill_set")
    @classmethod
    def _skill_set_has_no_internal_duplicate(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        for label in value:
            key = label.lower()
            if key in seen:
                raise ValueError("skillSet must not repeat a skill regardless of case")
            seen.add(key)
        return value

    @field_validator("suggested_skills")
    @classmethod
    def _suggested_skills_fit_and_are_unique(
        cls, value: list[str], info: ValidationInfo
    ) -> list[str]:
        skill_set: list[str] = info.data.get("skill_set", [])
        if len(skill_set) + len(value) > 20:
            raise ValueError("skillSet and suggestedSkills together must be at most 20 entries")
        seen = {label.lower() for label in skill_set}
        for label in value:
            key = label.lower()
            if key in seen:
                raise ValueError(
                    "suggestedSkills must not repeat a skill already in skillSet or "
                    "suggestedSkills, regardless of case"
                )
            seen.add(key)
        return value


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
    skill_set: list[SkillSetEntry] = Field(default=[], alias="skillSet", max_length=20)
    suggested_skills: list[SkillSetEntry] = Field(
        default=[], alias="suggestedSkills", max_length=20
    )
    github_url: ShowcaseUrl | None = Field(default=None, alias="githubUrl")
    linkedin_url: ShowcaseUrl | None = Field(default=None, alias="linkedinUrl")
    demo_data: bool = Field(default=True, alias="demoData")


# -- proof: credentials and projects (pending until an admin confirms them, #42) -------------------


class CredentialInput(Wire):
    title: Title
    issuer: Issuer
    # Sprint 005a (spec #86, story 15): a certification outside the nine-skill vocabulary has no
    # `skillId`; it stays display-only and never produces a `proves` fact (D-52). Existing
    # clients that always send `skillId` keep working unchanged. `skillId` keeps a plain default:
    # the builder's skill picker already exists, so an explicit `null` for "no vocabulary skill"
    # is meaningful. `issuedOn`/`credentialUrl` have no picker yet (#99); `default_factory` (like
    # `default_factory=list` elsewhere in this module) keeps the JSON Schema's `default` key out,
    # so the field is optional without inviting a client to send an explicit `null` for a field
    # its form doesn't have inputs for yet (W0 integration fix).
    skill_id: SkillId | None = Field(default=None, alias="skillId")
    issued_on: date | None = Field(default_factory=lambda: None, alias="issuedOn")
    credential_url: ShowcaseUrl | None = Field(default_factory=lambda: None, alias="credentialUrl")


class CredentialOut(Wire):
    id: str
    title: Title
    issuer: Issuer
    skill_id: SkillId | None = Field(default=None, alias="skillId")
    issued_on: date | None = Field(default=None, alias="issuedOn")
    credential_url: ShowcaseUrl | None = Field(default=None, alias="credentialUrl")
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
    # Sprint 005a (spec #86 story 55): a skill-less certification reaches this same queue, so
    # `skillId` must be nullable here too, or `GET /api/admin/pending` 500s on it.
    skill_id: SkillId | None = Field(default=None, alias="skillId")
    issued_on: date | None = Field(default=None, alias="issuedOn")
    credential_url: ShowcaseUrl | None = Field(default=None, alias="credentialUrl")
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


class PendingShowcase(Wire):
    """Admin card preview (spec #86 story 48): the same fields the public `ShowcaseCard` shows,
    plus the flags that drive the "Project not yet confirmed" / "Account not confirmed" warnings
    (story 49) and the showcase entry's own review status."""

    id: str
    builder_id: str = Field(alias="builderId")
    display_name: str = Field(alias="displayName")
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    title: Title
    description: ShowcaseDescription
    vertical: Vertical
    licensable: bool
    skill_ids: list[SkillId] = Field(alias="skillIds", min_length=1, max_length=5)
    live_url: ShowcaseUrl | None = Field(default=None, alias="liveUrl")
    demo_url: ShowcaseUrl | None = Field(default=None, alias="demoUrl")
    pitch_video_url: ShowcaseUrl | None = Field(default=None, alias="pitchVideoUrl")
    pitch_deck_url: ShowcaseUrl | None = Field(default=None, alias="pitchDeckUrl")
    pitch_video_id: PitchVideoId | None = Field(default=None, alias="pitchVideoId")
    showcase_status: ShowcaseStatus = Field(alias="showcaseStatus")
    # "Project not yet confirmed" / "Account not confirmed" (story 49): the entry can still be
    # confirmed, but it won't be public until both are true too (D-43's visibility predicate).
    project_status: AccountStatus = Field(alias="projectStatus")
    account_confirmed: bool = Field(alias="accountConfirmed")
    submitted_at: datetime = Field(alias="submittedAt")
    demo_data: bool = Field(default=True, alias="demoData")


class PendingQueue(Wire):
    accounts: list[PendingAccount]
    credentials: list[PendingCredential]
    projects: list[PendingProject]
    # Optional and defaulted so a client built before the showcase admin kind (#103) shipped
    # still validates this response.
    showcase: list[PendingShowcase] = Field(default=[])


DecisionStatus = Literal["confirmed", "rejected"]


class DecidedAccount(PendingAccount):
    """A confirmed or rejected account with its latest decision (spec #35 story 24, #49)."""

    status: DecisionStatus
    decided_at: datetime = Field(alias="decidedAt")


class DecidedCredential(PendingCredential):
    status: DecisionStatus
    decided_at: datetime = Field(alias="decidedAt")


class DecidedProject(PendingProject):
    status: DecisionStatus
    decided_at: datetime = Field(alias="decidedAt")


class DecidedShowcase(PendingShowcase):
    status: DecisionStatus
    decided_at: datetime = Field(alias="decidedAt")


class DecidedQueue(Wire):
    accounts: list[DecidedAccount]
    credentials: list[DecidedCredential]
    projects: list[DecidedProject]
    showcase: list[DecidedShowcase] = Field(default=[])


class AdminDecision(Wire):
    id: str
    kind: Literal["account", "credential", "project", "showcase"]
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


# -- Sprint 004 (spec #52 §HTTP API, #54): requests, bids, bookings, eligibility, dashboard -------
# Nine shapes mirrored by Zod. Money is integer USD per day (D-16); `proposedStart` is ISO 8601
# with offset in UTC and `proposedStartLocal` the same instant rendered in Africa/Nairobi.

RequestStatus = Literal["open", "closed"]
BidStatus = Literal["submitted"]
BookingState = Literal["proposed", "accepted", "countered", "confirmed"]
BookingAction = Literal["propose", "accept", "counter", "confirm"]
BookingActor = Literal["founder", "builder"]
DurationMin = Literal[30, 45]
BidMessage = Annotated[str, Field(max_length=1000)]
BookingNote = Annotated[str, Field(max_length=500)]
Count = Annotated[int, Field(ge=0, le=JS_SAFE_INT)]


class RouteSnapshot(Wire):
    """What the founder saw when publishing; display-only, never an input to eligibility."""

    status: RouteStatus
    total_daily_rate: SafeInt = Field(alias="totalDailyRate")
    builder_ids: list[str] = Field(alias="builderIds")


class RequestCreate(Wire):
    brief: VentureBrief
    route: RouteSnapshot


class Eligibility(Wire):
    """The engine's verdict for one builder on one brief: `eligible-builder` witnesses only."""

    eligible: bool
    skills: list[SkillId]
    path: ReasoningPath | None = None
    reason: str | None = None


class RequestOut(Wire):
    id: str
    founder_id: str = Field(alias="founderId")
    brief: VentureBrief
    route: RouteSnapshot
    title: str
    vertical: Vertical
    delivery_mode: DeliveryMode = Field(alias="deliveryMode")
    availability_start: date = Field(alias="availabilityStart")
    availability_end: date = Field(alias="availabilityEnd")
    daily_budget: PositiveSafeInt = Field(alias="dailyBudget")
    route_status: RouteStatus = Field(alias="routeStatus")
    status: RequestStatus
    closed_at: datetime | None = Field(default=None, alias="closedAt")
    created_at: datetime = Field(alias="createdAt")
    eligibility: Eligibility | None = None
    demo_data: bool = Field(default=True, alias="demoData")


class BidCreate(Wire):
    day_rate: PositiveSafeInt = Field(alias="dayRate")
    message: BidMessage = ""


class BidOut(Wire):
    id: str
    request_id: str = Field(alias="requestId")
    request_title: str = Field(alias="requestTitle")
    request_status: RequestStatus = Field(alias="requestStatus")
    builder_id: str = Field(alias="builderId")
    display_name: str = Field(alias="displayName")
    day_rate: PositiveSafeInt = Field(alias="dayRate")
    message: BidMessage
    eligible_skills: list[SkillId] = Field(alias="eligibleSkills")
    path: ReasoningPath
    status: BidStatus
    created_at: datetime = Field(alias="createdAt")
    demo_data: bool = Field(default=True, alias="demoData")


class BookingProposal(Wire):
    proposed_start: AwareDatetime = Field(alias="proposedStart")
    duration_min: DurationMin = Field(alias="durationMin")
    note: BookingNote = ""


class BookingCreate(BookingProposal):
    builder_id: str = Field(alias="builderId")
    request_id: str | None = Field(default=None, alias="requestId")


class BookingHistoryEntry(Wire):
    action: BookingAction
    actor: BookingActor
    state: BookingState
    proposed_start: AwareDatetime = Field(alias="proposedStart")
    proposed_start_local: str = Field(alias="proposedStartLocal")
    duration_min: DurationMin = Field(alias="durationMin")
    note: BookingNote
    at: AwareDatetime


class BookingOut(Wire):
    id: str
    request_id: str | None = Field(default=None, alias="requestId")
    request_title: str | None = Field(default=None, alias="requestTitle")
    founder_id: str = Field(alias="founderId")
    builder_id: str = Field(alias="builderId")
    display_name: str = Field(alias="displayName")
    state: BookingState
    proposed_start: AwareDatetime = Field(alias="proposedStart")
    proposed_start_local: str = Field(alias="proposedStartLocal")
    duration_min: DurationMin = Field(alias="durationMin")
    note: BookingNote
    history: list[BookingHistoryEntry]
    created_at: datetime = Field(alias="createdAt")
    demo_data: bool = Field(default=True, alias="demoData")


class RouteCounts(Wire):
    feasible: Count
    partial: Count
    infeasible: Count


class DashboardCounts(Wire):
    briefs: Count
    routes: RouteCounts
    open_requests: Count = Field(alias="openRequests")
    bids_received: Count = Field(alias="bidsReceived")
    bookings: Count


class Dashboard(Wire):
    counts: DashboardCounts
    requests: list[RequestOut]
    bids_received: list[BidOut] = Field(alias="bidsReceived")
    upcoming_bookings: list[BookingOut] = Field(alias="upcomingBookings")


# -- Sprint 005a (spec #86 §API contracts, §Web): Builder Showcase and skill suggestions --------
# Public reads never carry email, phone, location, day rate or availability (D-43). Link fields
# are plain strings capped at 500 chars; `https://` / host / YouTube rules are enforced by the
# endpoints through `app/marketplace/links.py` (#89), not by these wire shapes. `MatchedSkillKind`
# and `ShowcaseStatus` are declared with the other top-level literals above.


class MatchedSkill(Wire):
    """Which of a builder's skills matched a `GET /api/showcase?skill=` filter, and how. `skill`
    accepts a vocabulary id (e.g. `python`) or a free-text `skillSet`/`suggestedSkills` label; a
    self-described match's `id` is null and `label` carries the free text as typed."""

    id: SkillId | None = None
    label: str
    kind: MatchedSkillKind


class ShowcaseCard(Wire):
    """One gallery tile (spec #86 story 37): `GET /api/showcase` returns these in `items`."""

    id: str
    title: Title
    builder_id: str = Field(alias="builderId")
    display_name: DisplayName = Field(alias="displayName")
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    vertical: Vertical
    licensable: bool
    description: ShowcaseDescription
    skill_ids: list[SkillId] = Field(alias="skillIds", min_length=1, max_length=5)
    # Present only when the request carried `?skill=`: which kind of skill matched (story 32).
    matched_skill: MatchedSkill | None = Field(default=None, alias="matchedSkill")
    live_url: ShowcaseUrl | None = Field(default=None, alias="liveUrl")
    demo_url: ShowcaseUrl | None = Field(default=None, alias="demoUrl")
    pitch_video_url: ShowcaseUrl | None = Field(default=None, alias="pitchVideoUrl")
    pitch_deck_url: ShowcaseUrl | None = Field(default=None, alias="pitchDeckUrl")
    pitch_video_id: PitchVideoId | None = Field(default=None, alias="pitchVideoId")
    demo_data: bool = Field(default=True, alias="demoData")


class ShowcasePage(Wire):
    items: list[ShowcaseCard]
    total: Count


class ShowcaseBuilder(Wire):
    """The builder panel (story 42): verified skills, self-described chips, certifications and
    public profile links only; never email, phone, location, day rate or availability (D-43)."""

    builder_id: str = Field(alias="builderId")
    display_name: DisplayName = Field(alias="displayName")
    cohort_id: CohortId | None = Field(default=None, alias="cohortId")
    verified_skills: list[ProfileSkill] = Field(alias="verifiedSkills")
    # `skillSet` + `suggestedSkills` combined, labelled "Self-described", never "verified". Not
    # `BuilderProfile.selfDescribedSkills`, which stays the nine-vocabulary field, unchanged.
    skill_set: list[SkillSetEntry] = Field(alias="skillSet")
    certifications: list[CredentialOut]
    github_url: ShowcaseUrl | None = Field(default=None, alias="githubUrl")
    linkedin_url: ShowcaseUrl | None = Field(default=None, alias="linkedinUrl")


class ShowcaseDetail(Wire):
    """`GET /api/showcase/{projectId}` (story 41-42); a hidden or missing entry answers 404."""

    id: str
    title: Title
    vertical: Vertical
    licensable: bool
    description: ShowcaseDescription
    completed_on: date = Field(alias="completedOn")
    skill_ids: list[SkillId] = Field(alias="skillIds", min_length=1, max_length=5)
    live_url: ShowcaseUrl | None = Field(default=None, alias="liveUrl")
    demo_url: ShowcaseUrl | None = Field(default=None, alias="demoUrl")
    pitch_video_url: ShowcaseUrl | None = Field(default=None, alias="pitchVideoUrl")
    pitch_deck_url: ShowcaseUrl | None = Field(default=None, alias="pitchDeckUrl")
    pitch_video_id: PitchVideoId | None = Field(default=None, alias="pitchVideoId")
    builder: ShowcaseBuilder
    demo_data: bool = Field(default=True, alias="demoData")


class ShowcaseEdit(Wire):
    """`PUT /api/me/projects/{id}/showcase` body (story 1-12); owner only, 404 for others."""

    description: ShowcaseDescription = ""
    live_url: ShowcaseUrl | None = Field(default=None, alias="liveUrl")
    demo_url: ShowcaseUrl | None = Field(default=None, alias="demoUrl")
    pitch_video_url: ShowcaseUrl | None = Field(default=None, alias="pitchVideoUrl")
    pitch_deck_url: ShowcaseUrl | None = Field(default=None, alias="pitchDeckUrl")
    showcased: bool


class ShowcaseProject(ProjectOut):
    """The builder's own view of one project's showcase entry, returned by the edit endpoint and
    listed on `/profile` (story 5-9): the status pill the builder sees, not the public card.
    Extends `ProjectOut` (same `id/title/vertical/licensable/completedOn/skillIds/status/demoData`,
    same skillIds bounds) instead of duplicating it."""

    description: ShowcaseDescription
    live_url: ShowcaseUrl | None = Field(default=None, alias="liveUrl")
    demo_url: ShowcaseUrl | None = Field(default=None, alias="demoUrl")
    pitch_video_url: ShowcaseUrl | None = Field(default=None, alias="pitchVideoUrl")
    pitch_deck_url: ShowcaseUrl | None = Field(default=None, alias="pitchDeckUrl")
    showcased: bool
    showcase_status: ShowcaseStatus = Field(alias="showcaseStatus")


class SkillSuggestion(Wire):
    """One résumé-derived chip (D-50); `skillId` is set only when the label matches a vocabulary
    skill, so the builder still sees the vocabulary's display name."""

    label: SkillSetEntry
    skill_id: SkillId | None = Field(default=None, alias="skillId")


class SkillSuggestions(Wire):
    """`POST /api/me/skills/suggest` response. A null adapter, missing key or timeout answers
    `{available: false, suggestions: []}`, never a 5xx (D-50)."""

    available: bool
    suggestions: list[SkillSuggestion] = Field(max_length=20)


class SkillSuggestRequest(Wire):
    """`POST /api/me/skills/suggest` body. The text is sent to Claude Haiku 4.5 and is never
    stored or logged (D-50)."""

    resume_text: Annotated[str, Field(min_length=50, max_length=20000)] = Field(alias="resumeText")

# `PendingShowcase`/`DecidedShowcase` live with the other admin-queue row shapes above (next to
# `PendingProject`/`DecidedProject`), wired into `PendingQueue`/`DecidedQueue`'s `showcase` list.
