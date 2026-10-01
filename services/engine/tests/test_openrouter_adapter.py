"""Seam (D-53): OpenRouterAdapter over `httpx.MockTransport`.

The network is the system boundary, so it is the one thing mocked: a MockTransport captures every
request the adapter sends to `POST /chat/completions` and answers a canned chat-completion body.
Nothing here reaches OpenRouter.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.llm.anthropic_adapter import (
    EXPLANATION_INSTRUCTION,
    EXTRACTION_INSTRUCTION,
    SUGGEST_INSTRUCTION,
    AnthropicAdapter,
    SuggestedSkills,
)
from app.llm.base import SYSTEM_INSTRUCTION, ExtractedBrief, LlmUnavailable
from app.llm.openrouter_adapter import OpenRouterAdapter, strict_json_schema
from app.models.chat import PartialBrief
from app.models.engine import ReasoningPath, RuleName
from app.models.route import ReusableIp, RouteBuilder, RoutePartner, VentureRoute

BASE_URL = "https://openrouter.test/api/v1"
INTAKE_MODEL = "nvidia/intake-test"
EXPLAIN_MODEL = "openai/explain-test"
# A unique string that stands in for personal résumé content; it must never leak.
RESUME_MARKER = "ZQX-RESUME-MARKER-7731"

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
                    facts=["(earned amina-otieno cred-py-201)"],
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


def completion(content: str | None, finish_reason: str = "stop") -> dict[str, Any]:
    return {
        "id": "gen-test",
        "object": "chat.completion",
        "model": "test",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": finish_reason,
            }
        ],
    }


class FakeApi:
    """Captures requests; answers with a scripted response or raises a transport error."""

    def __init__(self, respond: Callable[[httpx.Request], httpx.Response]) -> None:
        self.requests: list[httpx.Request] = []
        self.bodies: list[dict[str, Any]] = []
        self._respond = respond

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        self.bodies.append(json.loads(request.content))
        return self._respond(request)

    def adapter(self) -> OpenRouterAdapter:
        client = httpx.Client(transport=httpx.MockTransport(self.handler), base_url=BASE_URL)
        return OpenRouterAdapter(client, intake_model=INTAKE_MODEL, explain_model=EXPLAIN_MODEL)


Respond = Callable[[httpx.Request], httpx.Response]


def ok(content: str | None, finish_reason: str = "stop") -> Respond:
    return lambda _request: httpx.Response(200, json=completion(content, finish_reason))


def has_key(value: Any, key: str) -> bool:
    """True when `key` appears as a mapping key anywhere in `value`."""
    if isinstance(value, dict):
        return key in value or any(has_key(v, key) for v in value.values())
    if isinstance(value, list):
        return any(has_key(v, key) for v in value)
    return False


def system_and_user(body: dict[str, Any]) -> tuple[str, str]:
    messages = body["messages"]
    assert [m["role"] for m in messages] == ["system", "user"]
    return messages[0]["content"], messages[1]["content"]


# ---- request shape per method -----------------------------------------------------------------


def test_extract_brief_posts_the_intake_model_without_reasoning_and_a_strict_schema() -> None:
    api = FakeApi(ok(json.dumps({"title": "Health pilot", "dailyBudget": 400})))
    current = PartialBrief.model_validate({"availabilityStart": "2026-09-22"})

    extracted = api.adapter().extract_brief("A health pilot, USD 400 a day", current)

    assert extracted.title == "Health pilot"
    assert extracted.daily_budget == 400
    request = api.requests[0]
    assert request.method == "POST"
    assert str(request.url) == f"{BASE_URL}/chat/completions"
    body = api.bodies[0]
    assert body["model"] == INTAKE_MODEL
    assert body["reasoning"] == {"enabled": False}
    fmt = body["response_format"]
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["strict"] is True
    assert fmt["json_schema"]["name"]
    assert fmt["json_schema"]["schema"] == strict_json_schema(ExtractedBrief.model_json_schema())
    assert body["provider"] == {"require_parameters": True}
    system, user = system_and_user(body)
    assert system == EXTRACTION_INSTRUCTION
    assert SYSTEM_INSTRUCTION in system
    assert "USD 400 a day" in user
    assert "2026-09-22" in user


def test_suggest_skills_posts_the_intake_model_with_the_suggested_skills_schema() -> None:
    api = FakeApi(ok(json.dumps({"skills": ["Python", "Kubernetes"]})))

    skills = api.adapter().suggest_skills("Built Python services on Kubernetes.")

    assert skills == ["Python", "Kubernetes"]
    body = api.bodies[0]
    assert body["model"] == INTAKE_MODEL
    assert body["reasoning"] == {"enabled": False}
    fmt = body["response_format"]
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["strict"] is True
    assert fmt["json_schema"]["schema"] == strict_json_schema(SuggestedSkills.model_json_schema())
    assert body["provider"] == {"require_parameters": True}
    system, user = system_and_user(body)
    assert system == SUGGEST_INSTRUCTION
    assert "Built Python services on Kubernetes." in user


def test_explain_route_posts_the_explain_model_with_reasoning_and_no_facts() -> None:
    api = FakeApi(ok("  Amina Otieno covers python.  "))

    summary = api.adapter().explain_route(ROUTE)

    assert summary == "Amina Otieno covers python."
    body = api.bodies[0]
    assert body["model"] == EXPLAIN_MODEL
    assert body["reasoning"] == {"enabled": True}
    assert body["max_tokens"] == 4096
    assert "response_format" not in body
    system, user = system_and_user(body)
    assert system == EXPLANATION_INSTRUCTION
    assert SYSTEM_INSTRUCTION in system
    sent = json.loads(user)
    assert sent == ROUTE.model_dump(by_alias=True, exclude=AnthropicAdapter.FACTS_EXCLUDED)
    assert not has_key(body, "facts")
    assert not has_key(sent, "facts")
    wire = json.dumps(body)
    assert "(earned" not in wire and "(licensable" not in wire and "(supports-vertical" not in wire
    assert "amina-otieno" in wire and "eligible-builder" in wire


def test_from_settings_builds_a_bearer_client_with_a_20s_timeout() -> None:
    settings = Settings(
        llm_provider="openrouter",
        openrouter_api_key="sk-or-test",
        openrouter_base_url=BASE_URL,
        openrouter_intake_model=INTAKE_MODEL,
        openrouter_explain_model=EXPLAIN_MODEL,
    )

    adapter = OpenRouterAdapter.from_settings(settings)

    assert adapter.name == "openrouter"
    assert adapter.intake_model == INTAKE_MODEL
    assert adapter.explain_model == EXPLAIN_MODEL
    assert str(adapter.client.base_url).rstrip("/") == BASE_URL
    assert adapter.client.headers["Authorization"] == "Bearer sk-or-test"
    assert adapter.client.timeout == httpx.Timeout(20.0)


# ---- strict-mode compatible schemas on the wire ------------------------------------------------

# Keywords strict json_schema providers reject; the local Pydantic validation still enforces them.
UNSUPPORTED_KEYWORDS = {
    "default",
    "format",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minItems",
    "maxItems",
}


def schema_nodes(node: Any) -> list[dict[str, Any]]:
    """Every schema node, walking `properties` and `$defs` values (never their names)."""
    if not isinstance(node, dict):
        return []
    found = [node]
    for key in ("properties", "$defs"):
        for child in node.get(key, {}).values():
            found += schema_nodes(child)
    for key in ("anyOf", "oneOf", "allOf"):
        for child in node.get(key, []):
            found += schema_nodes(child)
    if "items" in node:
        found += schema_nodes(node["items"])
    return found


def test_intake_schemas_on_the_wire_are_strict_mode_compatible() -> None:
    extract_api = FakeApi(ok(json.dumps({})))
    extract_api.adapter().extract_brief("hello", None)
    suggest_api = FakeApi(ok(json.dumps({"skills": []})))
    suggest_api.adapter().suggest_skills("Python developer")

    for body in (extract_api.bodies[0], suggest_api.bodies[0]):
        schema = body["response_format"]["json_schema"]["schema"]
        nodes = schema_nodes(schema)
        objects = [n for n in nodes if n.get("type") == "object" or "properties" in n]
        assert objects
        for node in objects:
            assert sorted(node.get("required", [])) == sorted(node.get("properties", {}))
            assert node["additionalProperties"] is False
        for node in nodes:
            assert not UNSUPPORTED_KEYWORDS & node.keys(), node
            assert "title" not in node
    extract_schema = extract_api.bodies[0]["response_format"]["json_schema"]["schema"]
    fields = ExtractedBrief.model_json_schema()["properties"]
    assert set(extract_schema["properties"]) == set(fields)
    assert "title" in extract_schema["properties"]  # the field named title survives


def test_an_all_null_extraction_reply_is_accepted() -> None:
    all_null = {key: None for key in ExtractedBrief.model_json_schema()["properties"]}
    api = FakeApi(ok(json.dumps(all_null)))

    extracted = api.adapter().extract_brief("hello", None)

    assert extracted == ExtractedBrief()


def test_local_validation_still_enforces_the_dropped_constraints() -> None:
    api = FakeApi(ok(json.dumps({"maximumTeamSize": 99, "dailyBudget": 0})))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)


# ---- failure modes -> LlmUnavailable ----------------------------------------------------------


def _raise_timeout(_request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout("slow")


FAILURES: list[tuple[str, Callable[[httpx.Request], httpx.Response]]] = [
    ("500", lambda _r: httpx.Response(500, json={"error": {"message": "boom"}})),
    ("429", lambda _r: httpx.Response(429, json={"error": {"message": "slow down"}})),
    ("timeout", _raise_timeout),
    ("malformed-body", lambda _r: httpx.Response(200, content=b"{not json")),
    ("no-choices", lambda _r: httpx.Response(200, json={"choices": []})),
    ("empty-content", ok(None)),
    ("length", ok(json.dumps({"skills": ["Python"]}), finish_reason="length")),
    ("content-filter", ok(json.dumps({"skills": ["Python"]}), finish_reason="content_filter")),
    ("error-finish", ok(json.dumps({"skills": ["Python"]}), finish_reason="error")),
]


@pytest.mark.parametrize(("label", "respond"), FAILURES, ids=[f[0] for f in FAILURES])
def test_http_and_body_failures_raise_llm_unavailable_for_every_method(
    label: str, respond: Callable[[httpx.Request], httpx.Response]
) -> None:
    api = FakeApi(respond)

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)
    with pytest.raises(LlmUnavailable):
        api.adapter().suggest_skills("Python developer")
    with pytest.raises(LlmUnavailable):
        api.adapter().explain_route(ROUTE)


def test_intake_content_that_is_not_json_raises_llm_unavailable() -> None:
    api = FakeApi(ok("not json"))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)
    with pytest.raises(LlmUnavailable):
        api.adapter().suggest_skills("Python developer")


def test_intake_content_that_breaks_the_schema_raises_llm_unavailable() -> None:
    api = FakeApi(ok(json.dumps({"title": "x", "status": "feasible", "skills": 3})))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("hello", None)
    with pytest.raises(LlmUnavailable):
        api.adapter().suggest_skills("Python developer")


def test_whitespace_only_explanation_raises_llm_unavailable() -> None:
    api = FakeApi(ok("   "))

    with pytest.raises(LlmUnavailable):
        api.adapter().explain_route(ROUTE)


# ---- the résumé text never leaks (D-50) --------------------------------------------------------


def _echo_marker_500(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(500, json={"error": {"message": f"bad input: {RESUME_MARKER}"}})


def _echo_marker_invalid(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=completion(json.dumps({"skills": RESUME_MARKER})))


def _echo_marker_not_json(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=completion(f"Sure! {RESUME_MARKER}"))


def _raise_marker_timeout(_request: httpx.Request) -> httpx.Response:
    raise httpx.ReadTimeout(f"timed out sending {RESUME_MARKER}")


LEAKS = [
    ("500-echo", _echo_marker_500),
    ("schema-echo", _echo_marker_invalid),
    ("not-json-echo", _echo_marker_not_json),
    ("timeout-echo", _raise_marker_timeout),
]


@pytest.mark.parametrize(("label", "respond"), LEAKS, ids=[leak[0] for leak in LEAKS])
def test_resume_text_is_absent_from_logs_and_the_exception(
    label: str,
    respond: Callable[[httpx.Request], httpx.Response],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    api = FakeApi(respond)

    with pytest.raises(LlmUnavailable) as raised:
        api.adapter().suggest_skills(f"Résumé of {RESUME_MARKER}: Python, Rust")

    exc = raised.value
    assert RESUME_MARKER in json.dumps(api.bodies[0], ensure_ascii=False)  # it was sent
    assert RESUME_MARKER not in caplog.text
    for record in caplog.records:
        assert RESUME_MARKER not in repr(record.args)
        assert record.exc_info is None
    assert RESUME_MARKER not in str(exc)
    assert RESUME_MARKER not in repr(exc.args)
    assert exc.__cause__ is None
    assert exc.__suppress_context__ is True
    if exc.__context__ is not None:
        assert RESUME_MARKER not in repr(exc.__context__)
        assert RESUME_MARKER not in str(exc.__context__)
