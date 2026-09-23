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
        "BuilderProfile",
        "Candidate",
        "ChatResponse",
        "ChatTurn",
        "Credential",
        "CredentialInput",
        "Gap",
        "PendingQueue",
        "ProfileInput",
        "Project",
        "ProjectInput",
        "ReasoningPath",
        "RoleResponse",
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
    "dailyBudget": 400,
    "preferReusableIp": True,
}


@pytest.mark.parametrize(
    ("override", "field", "fragment"),
    [
        ({"deliveryMode": "in-person"}, "deliveryMode", "'remote', 'hybrid' or 'on-site'"),
        ({"dailyBudget": 0}, "dailyBudget", "greater than 0"),
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
