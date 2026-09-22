"""Seam: LlmAdapter protocol via a fake adapter, driving the orchestrator (Sprint 001, #14).

The route function is a stub: these tests prove the conversation brain (merge, missing fields,
clarify-or-route, LLM fallback, explanation boundary) without the runtime. HTTP lands in #16.
"""

from typing import Any

import pytest

from app.conversation.orchestrator import (
    FORM_FALLBACK_HINT,
    REQUIRED_FIELDS,
    Orchestrator,
)
from app.llm.base import ExtractedBrief, LlmAdapter, LlmUnavailable
from app.llm.null_adapter import NullAdapter
from app.models.brief import VentureBrief
from app.models.chat import ChatTurn, PartialBrief
from app.models.engine import ReasoningPath, RuleName
from app.models.route import RouteBuilder, VentureRoute

HEALTH_FIELDS: dict[str, Any] = {
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

STUB_ROUTE = VentureRoute(
    status="feasible",
    builders=[
        RouteBuilder(
            builder_id="amina-otieno",
            name="Amina Otieno",
            day_rate=120,
            covers=["python"],
            evidence_type="both",
            evidence_paths=[
                ReasoningPath(rule=RuleName.ELIGIBLE_BUILDER, facts=[], conclusion="stub")
            ],
        )
    ],
    total_daily_rate=120,
    gaps=[],
    rules_applied=["eligible-builder"],
    summary="Feasible route: 1 builder (Amina Otieno) cover python for USD 120 a day.",
)
KNOWN_ENTITIES = frozenset({"amina-otieno", "hassan-abdi", "asset-afya-triage"})


def stub_route(brief: VentureBrief) -> VentureRoute:
    return STUB_ROUTE


class FakeAdapter:
    """LlmAdapter test double: scripted extraction and explanation."""

    name = "fake"

    def __init__(
        self,
        extracted: ExtractedBrief | None = None,
        explanation: str | None = None,
        unavailable: bool = False,
    ) -> None:
        self._extracted = extracted or ExtractedBrief()
        self._explanation = explanation
        self._unavailable = unavailable
        self.explained: list[VentureRoute] = []

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        if self._unavailable:
            raise LlmUnavailable("fake outage")
        return self._extracted

    def explain_route(self, route: VentureRoute) -> str:
        if self._unavailable:
            raise LlmUnavailable("fake outage")
        self.explained.append(route)
        return self._explanation if self._explanation is not None else route.summary


def orchestrator(adapter: LlmAdapter) -> Orchestrator:
    return Orchestrator(adapter, stub_route, KNOWN_ENTITIES)


def test_vague_message_with_null_adapter_asks_for_every_required_field() -> None:
    response = orchestrator(NullAdapter()).handle(
        ChatTurn(userMessage="I want to build something for farmers")
    )

    assert response.type == "clarification"
    assert response.missing_fields == list(REQUIRED_FIELDS)
    assert response.partial_brief == PartialBrief()
    for field in REQUIRED_FIELDS:
        assert field in response.message
    assert not hasattr(response, "route")


def test_partial_extraction_asks_only_for_what_is_missing() -> None:
    adapter = FakeAdapter(ExtractedBrief(vertical="agri", dailyBudget=300))

    response = orchestrator(adapter).handle(ChatTurn(userMessage="an agri app, USD 300 a day"))

    assert response.type == "clarification"
    assert "vertical" not in response.missing_fields
    assert "dailyBudget" not in response.missing_fields
    assert len(response.missing_fields) == len(REQUIRED_FIELDS) - 2
    assert (response.partial_brief.vertical, response.partial_brief.daily_budget) == ("agri", 300)


def test_on_site_brief_without_location_is_asked_for_the_location() -> None:
    adapter = FakeAdapter(
        ExtractedBrief.model_validate({**HEALTH_FIELDS, "deliveryMode": "on-site"})
    )

    response = orchestrator(adapter).handle(ChatTurn(userMessage="on site please"))

    assert response.type == "clarification"
    assert response.missing_fields == ["location"]


def test_full_extraction_routes_in_one_turn_with_a_generated_id() -> None:
    adapter = FakeAdapter(ExtractedBrief.model_validate(HEALTH_FIELDS))

    response = orchestrator(adapter).handle(ChatTurn(userMessage="the whole brief in prose"))

    assert response.type == "route"
    assert response.brief.id == "brief-health-pilot"
    assert response.brief.daily_budget == 400
    assert response.route == STUB_ROUTE
    assert adapter.explained == [STUB_ROUTE]


def test_latest_explicit_correction_wins_over_current_brief() -> None:
    current = PartialBrief.model_validate({**HEALTH_FIELDS, "id": "brief-health-01"})
    adapter = FakeAdapter(ExtractedBrief(dailyBudget=500))

    response = orchestrator(adapter).handle(
        ChatTurn(userMessage="make the budget 500", currentBrief=current)
    )

    assert response.type == "route"
    assert response.brief.id == "brief-health-01"
    assert response.brief.daily_budget == 500
    assert response.brief.title == "Health pilot"


def test_confirmed_brief_with_empty_message_and_null_adapter_routes_unchanged() -> None:
    current = PartialBrief.model_validate({**HEALTH_FIELDS, "id": "brief-health-01"})

    response = orchestrator(NullAdapter()).handle(ChatTurn(userMessage="", currentBrief=current))

    assert response.type == "route"
    assert response.route == STUB_ROUTE
    assert response.brief == VentureBrief.model_validate({**HEALTH_FIELDS, "id": "brief-health-01"})


def test_invalid_merged_brief_is_a_validation_error_never_a_route() -> None:
    current = PartialBrief.model_validate(
        {**HEALTH_FIELDS, "availabilityStart": "2026-09-29", "availabilityEnd": "2026-09-22"}
    )

    response = orchestrator(NullAdapter()).handle(ChatTurn(userMessage="", currentBrief=current))

    assert response.type == "validation-error"
    assert "availabilityEnd" in response.message


@pytest.mark.parametrize("current", [None, PartialBrief.model_validate(HEALTH_FIELDS)])
def test_llm_outage_falls_back_to_null_behaviour_with_the_form_hint(
    current: PartialBrief | None,
) -> None:
    adapter = FakeAdapter(unavailable=True)

    response = orchestrator(adapter).handle(ChatTurn(userMessage="hello", currentBrief=current))

    assert response.type == ("route" if current else "clarification")
    assert FORM_FALLBACK_HINT in response.message
    if response.type == "route":
        assert response.route.summary == STUB_ROUTE.summary


def test_explanation_naming_an_entity_outside_the_route_is_replaced_by_the_template() -> None:
    adapter = FakeAdapter(
        ExtractedBrief.model_validate(HEALTH_FIELDS),
        explanation="Amina Otieno is great; you could also try Hassan Abdi.",
    )

    response = orchestrator(adapter).handle(ChatTurn(userMessage="route me"))

    assert response.type == "route"
    assert response.route.summary == STUB_ROUTE.summary


def test_explanation_naming_only_route_entities_becomes_the_summary() -> None:
    adapter = FakeAdapter(
        ExtractedBrief.model_validate(HEALTH_FIELDS),
        explanation="Amina Otieno covers python with both a credential and a project.",
    )

    response = orchestrator(adapter).handle(ChatTurn(userMessage="route me"))

    assert response.type == "route"
    assert (
        response.route.summary == "Amina Otieno covers python with both a credential and a project."
    )
    assert response.route.model_dump(exclude={"summary"}) == STUB_ROUTE.model_dump(
        exclude={"summary"}
    )
