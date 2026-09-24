"""Seam: HTTP GET /api/ecosystem (D-19, #79). The footer's Partners page renders these seed
entities; they come from plain `match` queries over the space, no rule and no LLM involved."""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.runtime


def test_ecosystem_lists_the_seed_partners_universities_and_licensable_assets(
    client: TestClient,
) -> None:
    response = client.get("/api/ecosystem")

    assert response.status_code == 200
    body = response.json()
    assert body["partners"] == [
        {"partnerId": "afya-plus", "verticals": ["health"]},
        {"partnerId": "amani-health", "verticals": ["health"]},
        {"partnerId": "elimu-education", "verticals": ["education"]},
        {"partnerId": "shamba-agri", "verticals": ["agri"]},
    ]
    assert body["universities"] == [
        {"universityId": "lakeside-university", "cohorts": ["cohort-2026b"]},
        {"universityId": "omni-university", "cohorts": ["cohort-2026a"]},
        {"universityId": "savanna-institute", "cohorts": ["cohort-2025c"]},
    ]
    # Only licensable assets are reusable IP (reuse-fit); the two non-licensable seed assets
    # (asset-clinic-dash, asset-soil-model) never appear.
    assert body["assets"] == [
        {"assetId": "asset-afya-triage", "title": "Afya Triage", "vertical": "health"},
        {"assetId": "asset-elimu-quiz", "title": "Elimu Quiz", "vertical": "education"},
        {"assetId": "asset-shamba-records", "title": "Shamba Records", "vertical": "agri"},
    ]
    assert body["demoData"] is True
