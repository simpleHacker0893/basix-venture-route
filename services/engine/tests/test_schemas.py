"""Seam: Zod <-> Pydantic JSON Schema parity, engine side (Sprint 001, D-19).

The Vitest in packages/contracts compares Zod's output with the committed `src/schema.json`.
This test keeps that file honest: it must equal a fresh export of the Pydantic mirrors.
It also pins the field-specific validation messages the HTTP layer surfaces (requirements.md
item 2; acceptance.md "Validation errors").
"""

import json
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.marketplace.schemas import BidCreate, BidOut, ProfileInput, RequestOut
from app.models.brief import VentureBrief

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from export_schema import SCHEMA_PATH, export, render  # noqa: E402


def test_committed_schema_json_equals_fresh_pydantic_export() -> None:
    assert SCHEMA_PATH.exists(), "run scripts/export_schema.py"

    assert SCHEMA_PATH.read_text(encoding="utf-8") == render(export())


def test_export_covers_the_shared_contracts() -> None:
    assert sorted(json.loads(render(export()))) == [
        "AdminDecision",
        "Bid",
        "BidCreate",
        "Booking",
        "BookingCreate",
        "BookingProposal",
        "BuilderProfile",
        "Candidate",
        "ChatResponse",
        "ChatTurn",
        "Credential",
        "CredentialInput",
        "Dashboard",
        "DecidedQueue",
        "DecidedShowcase",
        "Ecosystem",
        "Eligibility",
        "Gap",
        "PendingQueue",
        "PendingShowcase",
        "ProfileInput",
        "Project",
        "ProjectInput",
        "ReasoningPath",
        "Request",
        "RequestCreate",
        "RoleResponse",
        # Sprint 005a showcase and skill suggestion contracts (spec #86).
        "ShowcaseCard",
        "ShowcaseDetail",
        "ShowcaseEdit",
        "ShowcasePage",
        "ShowcaseProject",
        "SkillSuggestRequest",
        "SkillSuggestions",
        "VentureBrief",
        "VentureRoute",
    ]


HEALTH_PILOT: dict[str, Any] = {
    "id": "brief-health-01",
    "title": "Health pilot",
    "vertical": "health",
    "requiredSkills": ["python", "ai-metta", "ui-ux"],
    "maximumTeamSize": 3,
    "availabilityStart": "2026-09-22",
    "availabilityEnd": "2026-09-29",
    "deliveryMode": "hybrid",
    "hourlyBudget": 50,
    "preferReusableIp": True,
}


@pytest.mark.parametrize(
    ("override", "field", "fragment"),
    [
        ({"deliveryMode": "in-person"}, "deliveryMode", "'remote', 'hybrid' or 'on-site'"),
        ({"hourlyBudget": 0}, "hourlyBudget", "greater than or equal to 1"),
        ({"hourlyBudget": 251}, "hourlyBudget", "less than or equal to 250"),
        ({"vertical": "fintech"}, "vertical", "'health', 'agri' or 'education'"),
        ({"deliveryMode": "on-site"}, "location", "required when deliveryMode is on-site"),
        ({"maximumTeamSize": 6}, "maximumTeamSize", "less than or equal to 5"),
        ({"requiredSkills": []}, "requiredSkills", "at least 1 item"),
        ({"availabilityEnd": "2026-09-21"}, "availabilityEnd", "must not precede"),
    ],
)
def test_brief_rejects_each_invalid_case_with_a_field_specific_message(
    override: dict[str, Any], field: str, fragment: str
) -> None:
    with pytest.raises(ValidationError) as excinfo:
        VentureBrief.model_validate({**HEALTH_PILOT, **override})

    errors = excinfo.value.errors()
    assert len(errors) == 1
    error = errors[0]
    assert fragment in error["msg"]
    location = ".".join(str(part) for part in error["loc"]) or field
    assert field in location or field in error["msg"]


BUILDER_PROFILE: dict[str, Any] = {
    "displayName": "Amina Otieno",
    "location": "Nairobi",
    "hourlyRate": 19,
    "modes": {"remote": True, "hybrid": False, "onSite": False},
    "selfDescribedSkills": [],
    "sharing": {"email": True, "phone": False, "linkedin": False},
    "availability": [],
}


@pytest.mark.parametrize(
    ("override", "field"),
    [
        # `SkillSetEntry` strips whitespace before the length check, so "   " strips to "" and
        # fails `min_length=1` rather than being silently accepted as a blank chip.
        ({"skillSet": ["   "]}, "skillSet"),
        ({"skillSet": ["Python", "python"]}, "skillSet"),
        (
            {
                "skillSet": [f"skill-{i}" for i in range(15)],
                "suggestedSkills": [f"more-{i}" for i in range(10)],
            },
            "suggestedSkills",
        ),
        ({"skillSet": ["Python"], "suggestedSkills": ["python"]}, "suggestedSkills"),
    ],
)
def test_profile_input_skill_labels_validation_names_the_field(
    override: dict[str, Any], field: str
) -> None:
    with pytest.raises(ValidationError) as excinfo:
        ProfileInput.model_validate({**BUILDER_PROFILE, **override})

    errors = excinfo.value.errors()
    assert len(errors) == 1
    location = ".".join(str(part) for part in errors[0]["loc"])
    assert location.split(".")[0] == field


@pytest.mark.parametrize("rate", [0, 50])
def test_profile_input_accepts_an_hourly_rate_of_zero_to_fifty(rate: int) -> None:
    """D-59: USD 0-50 an hour, 0 meaning free or volunteer."""
    assert ProfileInput.model_validate({**BUILDER_PROFILE, "hourlyRate": rate}).hourly_rate == rate


@pytest.mark.parametrize("rate", [-1, 51, 12.5])
def test_profile_input_rejects_an_hourly_rate_outside_zero_to_fifty(rate: float) -> None:
    with pytest.raises(ValidationError) as excinfo:
        ProfileInput.model_validate({**BUILDER_PROFILE, "hourlyRate": rate})

    errors = excinfo.value.errors()
    assert [error["loc"] for error in errors] == [("hourlyRate",)]


def test_profile_input_no_longer_takes_a_day_rate() -> None:
    body = {key: value for key, value in BUILDER_PROFILE.items() if key != "hourlyRate"}

    with pytest.raises(ValidationError):
        ProfileInput.model_validate({**body, "dayRate": 150})


# -- #160 (D-59): a request's budget and a bid's rate are per hour --------------------------------


@pytest.mark.parametrize("rate", [0, 50])
def test_bid_create_accepts_an_hourly_rate_of_zero_to_fifty(rate: int) -> None:
    assert BidCreate.model_validate({"hourlyRate": rate}).hourly_rate == rate


@pytest.mark.parametrize("rate", [-1, 51, 12.5])
def test_bid_create_rejects_an_hourly_rate_outside_zero_to_fifty(rate: float) -> None:
    with pytest.raises(ValidationError) as excinfo:
        BidCreate.model_validate({"hourlyRate": rate})

    assert [error["loc"] for error in excinfo.value.errors()] == [("hourlyRate",)]


def test_bid_create_no_longer_takes_a_day_rate() -> None:
    with pytest.raises(ValidationError):
        BidCreate.model_validate({"dayRate": 15})


def test_bid_out_carries_the_hourly_rate_with_the_profile_bounds() -> None:
    field = BidOut.model_fields["hourly_rate"]
    assert field.alias == "hourlyRate"
    assert "day_rate" not in BidOut.model_fields
    schema = BidOut.model_json_schema(by_alias=True)["properties"]["hourlyRate"]
    assert (schema["minimum"], schema["maximum"]) == (0, 50)


def test_request_out_carries_the_hourly_budget_one_to_two_fifty() -> None:
    assert RequestOut.model_fields["hourly_budget"].alias == "hourlyBudget"
    assert "daily_budget" not in RequestOut.model_fields
    schema = RequestOut.model_json_schema(by_alias=True)["properties"]["hourlyBudget"]
    assert (schema["minimum"], schema["maximum"]) == (1, 250)
