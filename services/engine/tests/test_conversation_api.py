"""Seam: HTTP POST /api/conversation (Sprint 001, #16, D-19).

Runs with LLM_PROVIDER=null (conftest): every response type is served by NullAdapter and the
route equals the form path. An LLM outage is simulated by overriding the orchestrator
dependency with a fake adapter that raises LlmUnavailable.
"""

import json
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.conversation import get_orchestrator
from app.config import Settings, get_settings
from app.conversation.orchestrator import FORM_FALLBACK_HINT, REQUIRED_FIELDS, Orchestrator
from app.llm.base import ExtractedBrief, LlmUnavailable
from app.llm.factory import select_adapter
from app.llm.null_adapter import NullAdapter
from app.main import app
from app.models.chat import PartialBrief
from app.models.route import VentureRoute

pytestmark = pytest.mark.runtime


def seed_brief(brief_id: str) -> dict[str, Any]:
    raw = json.loads((get_settings().seed_dir / "briefs.json").read_text(encoding="utf-8"))
    return dict(next(item for item in raw if item["id"] == brief_id))


class OutageAdapter:
    name = "outage"

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        raise LlmUnavailable("simulated timeout")

    def explain_route(self, route: VentureRoute) -> str:
        raise LlmUnavailable("simulated 5xx")


@pytest.fixture
def outage_client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        service = app.state.route_service
        app.dependency_overrides[get_orchestrator] = lambda: Orchestrator(
            OutageAdapter(), service.route, app.state.engine.known_entities()
        )
        try:
            yield test_client
        finally:
            app.dependency_overrides.clear()


def test_vague_message_returns_a_clarification_listing_every_required_field(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/conversation", json={"userMessage": "I want to build something for farmers"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "clarification"
    assert body["missingFields"] == list(REQUIRED_FIELDS)
    assert "route" not in body
    assert all(field in body["message"] for field in REQUIRED_FIELDS)


def test_confirmed_brief_routes_and_equals_the_form_path_byte_for_byte(
    client: TestClient,
) -> None:
    brief = seed_brief("brief-health-01")
    del brief["demoData"]  # PartialBrief carries the founder's fields only

    chat = client.post("/api/conversation", json={"userMessage": "", "currentBrief": brief})
    form = client.post("/api/route", json=seed_brief("brief-health-01"))

    assert chat.status_code == 200 and form.status_code == 200
    body = chat.json()
    assert body["type"] == "route"
    assert body["brief"]["id"] == "brief-health-01"
    assert body["route"]["status"] == "feasible"
    assert body["route"] == form.json()
    assert json.dumps(body["route"], sort_keys=True) == json.dumps(form.json(), sort_keys=True)


def test_invalid_merged_brief_is_a_validation_error_response(client: TestClient) -> None:
    brief = {**seed_brief("brief-health-01"), "availabilityEnd": "2026-09-01"}
    del brief["demoData"]

    response = client.post("/api/conversation", json={"userMessage": "", "currentBrief": brief})

    assert response.status_code == 200
    assert response.json()["type"] == "validation-error"
    assert "availabilityEnd" in response.json()["message"]


def test_malformed_current_brief_is_a_422_validation_error_never_a_500(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/conversation",
        json={"userMessage": "x", "currentBrief": {"deliveryMode": "in-person"}},
    )

    assert response.status_code == 422
    assert response.json()["type"] == "validation-error"
    assert "deliveryMode" in response.json()["message"]


def test_llm_outage_falls_back_to_null_behaviour_with_the_form_hint(
    outage_client: TestClient,
) -> None:
    brief = seed_brief("brief-health-01")
    del brief["demoData"]

    vague = outage_client.post("/api/conversation", json={"userMessage": "help me"})
    full = outage_client.post(
        "/api/conversation", json={"userMessage": "go", "currentBrief": brief}
    )
    form = outage_client.post("/api/route", json=seed_brief("brief-health-01"))

    assert vague.status_code == 200
    assert vague.json()["type"] == "clarification"
    assert FORM_FALLBACK_HINT in vague.json()["message"]
    assert full.status_code == 200
    assert full.json()["type"] == "route"
    assert FORM_FALLBACK_HINT in full.json()["message"]
    assert full.json()["route"] == form.json()


def test_without_an_anthropic_key_the_null_adapter_is_selected() -> None:
    assert isinstance(
        select_adapter(Settings(llm_provider="anthropic", anthropic_api_key=None)), NullAdapter
    )
    assert isinstance(
        select_adapter(Settings(llm_provider="null", anthropic_api_key="sk-test")), NullAdapter
    )
