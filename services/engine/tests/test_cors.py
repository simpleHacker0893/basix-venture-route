"""Seam: HTTP CORS preflight on POST /api/route (Sprint 002 #22, D-30)."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings

pytestmark = pytest.mark.runtime

PREFLIGHT = {"Access-Control-Request-Method": "POST"}


def test_preflight_from_an_allowed_origin_is_accepted(client: TestClient) -> None:
    response = client.options(
        "/api/route", headers={"Origin": "http://localhost:5173", **PREFLIGHT}
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_preflight_from_the_preview_origin_is_accepted(client: TestClient) -> None:
    response = client.options(
        "/api/route", headers={"Origin": "http://localhost:4173", **PREFLIGHT}
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4173"


def test_preflight_from_an_origin_outside_the_allow_list_gets_no_allow_origin(
    client: TestClient,
) -> None:
    response = client.options("/api/route", headers={"Origin": "https://evil.example", **PREFLIGHT})

    assert "access-control-allow-origin" not in response.headers
    assert response.status_code != 200


def test_actual_post_from_an_allowed_origin_carries_the_allow_origin_header(
    client: TestClient,
) -> None:
    response = client.get("/api/scenarios", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in response.headers


def test_cors_origins_env_is_a_comma_separated_list() -> None:
    settings = Settings(cors_origins="https://web.example, http://localhost:4173")

    assert settings.cors_origin_list == ["https://web.example", "http://localhost:4173"]
    assert Settings().cors_origin_list == ["http://localhost:5173", "http://localhost:4173"]
