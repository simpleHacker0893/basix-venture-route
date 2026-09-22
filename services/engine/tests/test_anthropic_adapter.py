"""Seam: LlmAdapter protocol, AnthropicAdapter over a fake transport (Sprint 001, #17).

The network is the system boundary, so it is the one thing mocked: an httpx2 MockTransport
captures every request the official SDK sends and answers a canned Messages API body. Nothing
here reaches Anthropic; the live run is the acceptance.md "Should" line.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import anthropic
import httpx2
import pytest

from app.llm.anthropic_adapter import MODEL, AnthropicAdapter
from app.llm.base import SYSTEM_INSTRUCTION, LlmUnavailable
from app.models.chat import PartialBrief
from app.models.engine import ReasoningPath, RuleName
from app.models.route import ReusableIp, RouteBuilder, RoutePartner, VentureRoute

ROUTE = VentureRoute(
    status="feasible",
    builders=[
        RouteBuilder(
            builder_id="amina-otieno",
            name="Amina Otieno",
            day_rate=120,
            covers=["python"],
            evidence_type="both",
            evidence_paths=[
                ReasoningPath(
                    rule=RuleName.ELIGIBLE_BUILDER,
                    facts=[
                        "(earned amina-otieno cred-py-201)",
                        "(built amina-otieno proj-afya-bot)",
                        "(confirmed admin-basix amina-otieno)",
                    ],
                    conclusion="amina-otieno is eligible for python with both evidence",
                )
            ],
        )
    ],
    total_daily_rate=120,
    reusable_ip=ReusableIp(
        asset_id="asset-afya-triage",
        title="Afya Triage",
        path=ReasoningPath(
            rule=RuleName.REUSE_FIT,
            facts=["(licensable asset-afya-triage)"],
            conclusion="asset-afya-triage is licensable",
        ),
    ),
    partner=RoutePartner(
        partner_id="amani-health",
        path=ReasoningPath(
            rule=RuleName.PARTNER_FIT,
            facts=["(supports-vertical amani-health health)"],
            conclusion="amani-health fits",
        ),
    ),
    gaps=[],
    rules_applied=["eligible-builder", "partner-fit", "reuse-fit"],
    summary="Feasible route: 1 builder (Amina Otieno) cover python for USD 120 a day.",
)

# Every seed entity the route does not carry; none may appear in the explanation request.
OUTSIDE_ENTITIES = [
    "daniel-kiptoo",
    "grace-wambui",
    "hassan-abdi",
    "kevin-mutua",
    "brian-odhiambo",
    "asset-clinic-dash",
    "afya-plus",
]


def message_body(text: str, stop_reason: str = "end_turn") -> dict[str, Any]:
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": MODEL,
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 10},
    }


class FakeApi:
    """Captures requests; answers with a scripted response or raises a transport error."""

    def __init__(self, respond: Callable[[httpx2.Request], httpx2.Response]) -> None:
        self.requests: list[dict[str, Any]] = []
        self._respond = respond

    def handler(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(json.loads(request.content))
        return self._respond(request)

    def adapter(self) -> AnthropicAdapter:
        client = anthropic.Anthropic(
            api_key="sk-ant-test",
            max_retries=0,
            http_client=anthropic.DefaultHttpxClient(transport=httpx2.MockTransport(self.handler)),
        )
        return AnthropicAdapter(client)


def ok(text: str) -> Callable[[httpx2.Request], httpx2.Response]:
    return lambda _request: httpx2.Response(200, json=message_body(text))


# ---- explanation boundary (acceptance.md "LLM boundary test") ---------------------------------


def test_explanation_request_carries_the_structured_route_and_no_fact_atoms() -> None:
    api = FakeApi(ok("Amina Otieno covers python with both a credential and a project."))

    summary = api.adapter().explain_route(ROUTE)

    assert summary == "Amina Otieno covers python with both a credential and a project."
    request = api.requests[0]
    wire = json.dumps(request)
    assert "(earned" not in wire and "(built" not in wire and "(confirmed" not in wire
    assert "(licensable" not in wire and "(supports-vertical" not in wire
    for entity in OUTSIDE_ENTITIES:
        assert entity not in wire
    assert "amina-otieno" in wire and "asset-afya-triage" in wire and "amani-health" in wire
    assert "eligible-builder" in wire  # rule names and conclusions stay
    assert request["model"] == MODEL
    assert request["max_tokens"] == 4096
    assert SYSTEM_INSTRUCTION in json.dumps(request["system"])


def test_explanation_request_is_only_the_route_payload_after_the_system_instruction() -> None:
    api = FakeApi(ok("fine"))

    api.adapter().explain_route(ROUTE)

    request = api.requests[0]
    assert [m["role"] for m in request["messages"]] == ["user"]
    sent = json.loads(request["messages"][0]["content"])
    # route.model_dump() with every reasoning path's raw `facts` removed, nothing else.
    expected = ROUTE.model_dump(by_alias=True)
    for builder in expected["builders"]:
        for path in builder["evidencePaths"]:
            del path["facts"]
    for section in ("reusableIp", "cohort", "partner"):
        if expected[section] is not None:
            del expected[section]["path"]["facts"]
    assert sent == expected


# ---- intake extraction ------------------------------------------------------------------------


def test_extract_brief_uses_structured_output_and_returns_only_stated_fields() -> None:
    api = FakeApi(
        ok(
            json.dumps(
                {
                    "title": "Health pilot",
                    "vertical": "health",
                    "requiredSkills": ["python", "ai-metta"],
                    "maximumTeamSize": None,
                    "availabilityStart": None,
                    "availabilityEnd": None,
                    "deliveryMode": "hybrid",
                    "location": None,
                    "dailyBudget": 400,
                    "preferReusableIp": None,
                }
            )
        )
    )

    extracted = api.adapter().extract_brief(
        "A hybrid health pilot needing python and ai-metta, USD 400 a day", PartialBrief()
    )

    assert extracted.title == "Health pilot"
    assert extracted.vertical == "health"
    assert extracted.required_skills == ["python", "ai-metta"]
    assert extracted.daily_budget == 400
    assert extracted.maximum_team_size is None
    request = api.requests[0]
    assert request["model"] == MODEL
    assert request["output_config"]["format"]["type"] == "json_schema"
    assert "requiredSkills" in request["output_config"]["format"]["schema"]["properties"]
    assert "USD 400 a day" in json.dumps(request["messages"])


def test_extract_brief_serialises_a_dated_current_brief_as_json_context() -> None:
    """A second turn carries dates in `currentBrief`; they must reach the wire as ISO strings."""
    api = FakeApi(ok(json.dumps({"dailyBudget": 500})))
    current = PartialBrief.model_validate(
        {"availabilityStart": "2026-09-22", "availabilityEnd": "2026-09-29", "dailyBudget": 400}
    )

    extracted = api.adapter().extract_brief("make the budget 500", current)

    assert extracted.daily_budget == 500
    assert "2026-09-22" in json.dumps(api.requests[0]["messages"])


def test_extract_brief_never_returns_unknown_fields() -> None:
    api = FakeApi(ok(json.dumps({"title": "x", "status": "feasible", "builders": ["hassan-abdi"]})))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("route me", None)


# ---- failure modes -> LlmUnavailable, so the orchestrator falls back to NullAdapter ------------


@pytest.mark.parametrize(
    ("label", "respond"),
    [
        ("500", lambda _r: httpx2.Response(500, json={"type": "error", "error": {}})),
        ("429", lambda _r: httpx2.Response(429, json={"type": "error", "error": {}})),
        ("401", lambda _r: httpx2.Response(401, json={"type": "error", "error": {}})),
        ("timeout", lambda _r: (_ for _ in ()).throw(httpx2.ReadTimeout("slow"))),
        ("refusal", lambda _r: httpx2.Response(200, json=message_body("", "refusal"))),
    ],
)
def test_api_errors_timeouts_and_refusals_raise_llm_unavailable(
    label: str, respond: Callable[[httpx2.Request], httpx2.Response]
) -> None:
    api = FakeApi(respond)

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)
    with pytest.raises(LlmUnavailable):
        api.adapter().explain_route(ROUTE)


def test_extraction_reply_that_is_not_json_raises_llm_unavailable() -> None:
    api = FakeApi(ok("not json"))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)


def test_adapter_from_settings_uses_the_env_key_model_timeout_and_retries() -> None:
    from app.config import Settings
    from app.llm.factory import select_adapter

    adapter = select_adapter(Settings(llm_provider="anthropic", anthropic_api_key="sk-ant-test"))

    assert isinstance(adapter, AnthropicAdapter)
    assert adapter.name == "anthropic"
    assert adapter.client.max_retries == 2
    assert adapter.client.timeout in (20.0, httpx2.Timeout(20.0))
