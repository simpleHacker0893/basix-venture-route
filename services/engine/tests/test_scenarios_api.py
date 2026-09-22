"""Seam: HTTP POST /api/route and POST /api/conversation, the five DOMAIN.md scenarios (#18).

Expected teams, totals and gaps are the exact literals from planning/DOMAIN.md §Demo scenarios
and acceptance.md (D-22, D-23). Both paths run with LLM_PROVIDER=null and must agree byte for
byte on the `route` object.
"""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings

pytestmark = pytest.mark.runtime

SCENARIOS: dict[str, dict[str, Any]] = {
    "brief-health-01": {
        "status": "feasible",
        "builders": [
            ("amina-otieno", "both"),
            ("daniel-kiptoo", "both"),
            ("grace-wambui", "credential"),
        ],
        "totalDailyRate": 370,
        "reusableIp": "asset-afya-triage",
        "cohortOf": "amina-otieno",
        "partner": "amani-health",
        "gaps": [],
    },
    "brief-agri-01": {
        "status": "feasible",
        "builders": [
            ("fatuma-hassan", "credential"),
            ("lucy-achieng", "project"),
            ("wanjiru-mwangi", "credential"),
        ],
        "totalDailyRate": 315,
        "reusableIp": "asset-shamba-records",
        "cohortOf": "fatuma-hassan",
        "partner": "shamba-agri",
        "gaps": [],
    },
    "brief-constrained-01": {
        "status": "partial",
        "builders": [("zawadi-njoroge", "credential")],
        "totalDailyRate": 130,
        "reusableIp": None,
        "cohortOf": "zawadi-njoroge",
        "partner": None,
        "gaps": [("skill", ["mobile"], "route-gap")],
    },
    "brief-budget-01": {
        "status": "partial",
        "builders": [],
        "totalDailyRate": 0,
        "reusableIp": "asset-afya-triage",
        "cohortOf": None,
        "partner": None,
        "gaps": [
            (
                "budget",
                ["amina-otieno", "daniel-kiptoo", "grace-wambui"],
                "assembler.budget-fit",
            )
        ],
    },
    "brief-onsite-01": {
        "status": "infeasible",
        "builders": [],
        "totalDailyRate": 0,
        "reusableIp": None,
        "cohortOf": None,
        "partner": None,
        "gaps": [
            ("location", ["ai-metta"], "route-gap"),
            ("location", ["python"], "route-gap"),
            ("location", ["ui-ux"], "route-gap"),
        ],
    },
}


def seed_briefs() -> dict[str, dict[str, Any]]:
    raw = json.loads((get_settings().seed_dir / "briefs.json").read_text(encoding="utf-8"))
    return {item["id"]: dict(item) for item in raw}


def via_form(client: TestClient, brief_id: str) -> dict[str, Any]:
    response = client.post("/api/route", json=seed_briefs()[brief_id])
    assert response.status_code == 200, response.text
    route: dict[str, Any] = response.json()
    return route


def via_chat(client: TestClient, brief_id: str) -> dict[str, Any]:
    brief = seed_briefs()[brief_id]
    del brief["demoData"]
    response = client.post("/api/conversation", json={"userMessage": "", "currentBrief": brief})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["type"] == "route", body
    route: dict[str, Any] = body["route"]
    return route


PATHS = [("form", via_form), ("chat", via_chat)]


@pytest.mark.parametrize("brief_id", list(SCENARIOS))
@pytest.mark.parametrize(("path", "fetch"), PATHS, ids=[p for p, _ in PATHS])
def test_scenario_matches_domain_md_exactly(
    client: TestClient, brief_id: str, path: str, fetch: Any
) -> None:
    expected = SCENARIOS[brief_id]

    route = fetch(client, brief_id)

    assert route["status"] == expected["status"]
    assert [(b["builderId"], b["evidenceType"]) for b in route["builders"]] == expected["builders"]
    assert route["totalDailyRate"] == expected["totalDailyRate"]
    assert (route["reusableIp"] or {}).get("assetId") == expected["reusableIp"]
    assert (route["partner"] or {}).get("partnerId") == expected["partner"]
    if expected["cohortOf"] is None:
        assert route["cohort"] is None
    else:
        assert route["cohort"]["path"]["facts"][0].startswith(
            f"(belongs-to {expected['cohortOf']} "
        )
    assert [(g["category"], g["affected"], g["rule"]) for g in route["gaps"]] == expected["gaps"]
    assert route["summary"]


def test_health_pilot_partner_has_a_four_fact_path_and_cohort_of_amina(client: TestClient) -> None:
    route = via_form(client, "brief-health-01")

    assert route["cohort"]["cohortId"] == "cohort-2026a"
    assert route["partner"]["path"]["rule"] == "partner-fit"
    assert route["partner"]["path"]["facts"] == [
        "(supports-vertical amani-health health)",
        "(partners-with amani-health omni-university)",
        "(cohort-of cohort-2026a omni-university)",
        "(belongs-to amina-otieno cohort-2026a)",
    ]


def test_agri_cost_ordering_beats_evidence_ordering(client: TestClient) -> None:
    route = via_form(client, "brief-agri-01")

    assert "brian-odhiambo" not in {b["builderId"] for b in route["builders"]}
    lucy = next(b for b in route["builders"] if b["builderId"] == "lucy-achieng")
    assert (lucy["dayRate"], lucy["evidenceType"]) == (95, "project")


def test_budget_challenge_gap_is_exactly_d22(client: TestClient) -> None:
    route = via_form(client, "brief-budget-01")

    gap = route["gaps"][0]
    assert "370" in gap["statement"] and "250" in gap["statement"]
    assert gap["nextActions"] == ["Raise daily budget to USD 370"]


def test_constrained_brief_fabricates_no_mobile_builder(client: TestClient) -> None:
    route = via_form(client, "brief-constrained-01")

    assert all("mobile" not in b["covers"] for b in route["builders"])
    assert route["gaps"][0]["nextActions"]


@pytest.mark.parametrize("brief_id", list(SCENARIOS))
def test_form_path_and_chat_path_return_a_byte_identical_route(
    client: TestClient, brief_id: str
) -> None:
    form = via_form(client, brief_id)
    chat = via_chat(client, brief_id)

    assert json.dumps(form, sort_keys=True).encode() == json.dumps(chat, sort_keys=True).encode()
