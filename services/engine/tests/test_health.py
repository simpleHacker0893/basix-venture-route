"""Seam: HTTP GET /health (D-19). Real runtime behind FastAPI's lifespan."""

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.runtime


def test_hyperon_runtime_is_importable() -> None:
    import hyperon

    assert hasattr(hyperon, "MeTTa")


def test_health_reports_loaded_graph_and_runtime_version(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["facts_loaded"] > 0
    assert isinstance(body["rules_loaded"], int)
    assert body["hyperon_version"] == "0.2.10"
    assert body["demo_today"] == "2026-09-22"
