"""Seam: HTTP POST /internal/query (D-19), dev-only behind ENGINE_DEV_QUERY."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

pytestmark = pytest.mark.runtime


@pytest.fixture
def dev_client() -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: Settings(engine_dev_query=True)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_internal_query_is_absent_unless_enabled(client: TestClient) -> None:
    response = client.post("/internal/query", json={"briefId": "brief-health-01"})

    assert response.status_code == 404


def test_internal_query_returns_typed_results_for_a_seed_brief(dev_client: TestClient) -> None:
    response = dev_client.post("/internal/query", json={"briefId": "brief-health-01"})

    assert response.status_code == 200
    body = response.json()
    assert body["briefId"] == "brief-health-01"
    eligible = {(t["builder_id"], t["skill_id"]): t for t in body["eligible"]}
    assert eligible[("amina-otieno", "python")]["evidence"] == "both"
    assert eligible[("amina-otieno", "python")]["path"]["rule"] == "eligible-builder"
    assert [r["asset_id"] for r in body["reuse"]] == ["asset-afya-triage"]
    # One partner candidate per eligible builder; all three health builders share the cohort.
    assert {p["partner_id"] for p in body["partners"]} == {"amani-health"}
    assert sorted(p["builder_id"] for p in body["partners"]) == [
        "amina-otieno",
        "daniel-kiptoo",
        "grace-wambui",
    ]
    assert body["partners"][0]["path"]["facts"][0] == "(supports-vertical amani-health health)"
    assert body["gaps"] == []


def test_internal_query_unknown_brief_is_404(dev_client: TestClient) -> None:
    response = dev_client.post("/internal/query", json={"briefId": "brief-none"})

    assert response.status_code == 404
    assert "brief-none" in response.json()["detail"]


def test_health_reports_all_seven_named_rules(client: TestClient) -> None:
    assert client.get("/health").json()["rules_loaded"] == 7
