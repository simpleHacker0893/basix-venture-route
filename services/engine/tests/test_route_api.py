"""Seam: HTTP POST /api/route (form path) and GET /api/scenarios (Sprint 001, #15, D-19)."""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings

pytestmark = pytest.mark.runtime


def seed_brief(brief_id: str) -> dict[str, Any]:
    raw = json.loads((get_settings().seed_dir / "briefs.json").read_text(encoding="utf-8"))
    match = [item for item in raw if item["id"] == brief_id]
    assert match, brief_id
    return dict(match[0])


def test_scenarios_returns_the_five_seed_briefs_in_seed_order(client: TestClient) -> None:
    response = client.get("/api/scenarios")

    assert response.status_code == 200
    assert [b["id"] for b in response.json()] == [
        "brief-health-01",
        "brief-agri-01",
        "brief-constrained-01",
        "brief-budget-01",
        "brief-onsite-01",
    ]
    assert response.json()[0]["requiredSkills"] == ["python", "ai-metta", "ui-ux"]
    assert all(b["demoData"] is True for b in response.json())


def test_route_form_path_health_pilot_is_feasible_on_the_wire(client: TestClient) -> None:
    response = client.post("/api/route", json=seed_brief("brief-health-01"))

    assert response.status_code == 200
    route = response.json()
    assert route["status"] == "feasible"
    assert [(b["builderId"], b["evidenceType"]) for b in route["builders"]] == [
        ("amina-otieno", "both"),
        ("daniel-kiptoo", "both"),
        ("grace-wambui", "credential"),
    ]
    assert route["builders"][0]["name"] == "Amina Otieno"
    assert route["builders"][0]["dayRate"] == 120
    assert route["totalDailyRate"] == 370
    assert route["reusableIp"]["assetId"] == "asset-afya-triage"
    assert route["cohort"]["cohortId"] == "cohort-2026a"
    assert route["partner"]["partnerId"] == "amani-health"
    assert len(route["partner"]["path"]["facts"]) == 4
    assert route["gaps"] == []
    assert "rulesApplied" in route and "total_daily_rate" not in route


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"deliveryMode": "in-person"}, "deliveryMode"),
        ({"dailyBudget": 0}, "dailyBudget"),
        ({"vertical": "fintech"}, "vertical"),
        ({"deliveryMode": "on-site"}, "location"),
    ],
)
def test_route_validation_errors_are_field_specific_and_never_a_route(
    client: TestClient, override: dict[str, Any], field: str
) -> None:
    response = client.post("/api/route", json={**seed_brief("brief-health-01"), **override})

    assert response.status_code == 422
    body = response.json()
    assert body["type"] == "validation-error"
    assert field in body["message"]
    assert "status" not in body and "builders" not in body


def test_route_rejects_a_non_json_body_with_a_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/route", content=b"not json", headers={"Content-Type": "text/plain"}
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
