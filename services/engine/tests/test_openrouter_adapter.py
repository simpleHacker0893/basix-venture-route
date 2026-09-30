"""Seam: OpenRouterAdapter over a fake transport (LLM_PROVIDER=openrouter).

The network is the system boundary, so it is the one thing mocked: an httpx MockTransport
captures every request the adapter sends to OpenRouter's chat-completions endpoint and answers a
canned body. Nothing here reaches OpenRouter. The adapter keeps the same LLM boundary as the
Anthropic one: the system instruction is verbatim, and no reasoning-path fact atom is ever sent.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.llm.base import SYSTEM_INSTRUCTION, LlmUnavailable
from app.llm.openrouter_adapter import (
    BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_SUGGEST_MODEL,
    OpenRouterAdapter,
)
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

RESUME = "Jane Doe, jane@example.com. Senior Python and Rust engineer at Acme since 2019."


def completion(content: str, finish_reason: str = "stop") -> dict[str, Any]:
    return {
        "id": "gen-test",
        "object": "chat.completion",
        "model": DEFAULT_MODEL,
        "choices": [
            {
                "index": 0,
                "finish_reason": finish_reason,
                "message": {"role": "assistant", "content": content},
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
    }


class FakeApi:
    """Captures requests; answers with a scripted response or raises a transport error."""

    def __init__(self, respond: Callable[[httpx.Request], httpx.Response]) -> None:
        self.requests: list[httpx.Request] = []
        self._respond = respond

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._respond(request)

    def body(self, index: int = 0) -> dict[str, Any]:
        sent: dict[str, Any] = json.loads(self.requests[index].content)
        return sent

    def adapter(self, **kwargs: str) -> OpenRouterAdapter:
        client = httpx.Client(
            base_url=BASE_URL,
            headers={"Authorization": "Bearer sk-or-test"},
            transport=httpx.MockTransport(self.handler),
        )
        return OpenRouterAdapter(client, **kwargs)


def ok(content: str, finish_reason: str = "stop") -> Callable[[httpx.Request], httpx.Response]:
    return lambda _request: httpx.Response(200, json=completion(content, finish_reason))


# ---- explanation boundary ---------------------------------------------------------------------


def test_explanation_posts_chat_completions_with_the_route_and_no_fact_atoms() -> None:
    api = FakeApi(ok("Amina Otieno covers python with both a credential and a project."))

    summary = api.adapter().explain_route(ROUTE)

    assert summary == "Amina Otieno covers python with both a credential and a project."
    request = api.requests[0]
    assert request.method == "POST"
    assert str(request.url) == f"{BASE_URL}/chat/completions"
    body = api.body()
    assert body["model"] == DEFAULT_MODEL
    wire = json.dumps(body)
    assert "(earned" not in wire and "(built" not in wire and "(confirmed" not in wire
    assert "(licensable" not in wire and "(supports-vertical" not in wire
    assert "amina-otieno" in wire and "eligible-builder" in wire
    system, user = body["messages"]
    assert system["role"] == "system" and SYSTEM_INSTRUCTION in system["content"]
    assert user["role"] == "user"
    assert "response_format" not in body


def test_explanation_sends_exactly_the_route_without_facts() -> None:
    api = FakeApi(ok("fine"))

    api.adapter().explain_route(ROUTE)

    sent = json.loads(api.body()["messages"][1]["content"])
    expected = ROUTE.model_dump(by_alias=True)
    for builder in expected["builders"]:
        for path in builder["evidencePaths"]:
            del path["facts"]
    for section in ("reusableIp", "cohort", "partner"):
        if expected[section] is not None:
            del expected[section]["path"]["facts"]
    assert sent == expected


def test_the_model_can_be_overridden() -> None:
    api = FakeApi(ok("fine"))

    api.adapter(model="openai/gpt-5").explain_route(ROUTE)

    assert api.body()["model"] == "openai/gpt-5"


# ---- intake extraction ------------------------------------------------------------------------


def test_extract_brief_requests_a_json_schema_and_returns_only_stated_fields() -> None:
    api = FakeApi(
        ok(json.dumps({"title": "Health pilot", "requiredSkills": ["python"], "dailyBudget": 400}))
    )

    extracted = api.adapter().extract_brief(
        "A health pilot needing python, USD 400 a day", PartialBrief()
    )

    assert extracted.title == "Health pilot"
    assert extracted.required_skills == ["python"]
    assert extracted.daily_budget == 400
    assert extracted.vertical is None
    body = api.body()
    fmt = body["response_format"]
    assert fmt["type"] == "json_schema"
    assert "requiredSkills" in fmt["json_schema"]["schema"]["properties"]
    # Route only to providers that honour the schema.
    assert body["provider"] == {"require_parameters": True}
    assert "USD 400 a day" in json.dumps(body["messages"])


def test_extract_brief_accepts_json_wrapped_in_a_code_fence() -> None:
    api = FakeApi(ok('```json\n{"vertical": "agri"}\n```'))

    assert api.adapter().extract_brief("an agri app", None).vertical == "agri"


def test_extract_brief_serialises_a_dated_current_brief_as_json_context() -> None:
    api = FakeApi(ok(json.dumps({"dailyBudget": 500})))
    current = PartialBrief.model_validate(
        {"availabilityStart": "2026-09-22", "availabilityEnd": "2026-10-06"}
    )

    api.adapter().extract_brief("USD 500 a day", current)

    assert "2026-09-22" in api.body()["messages"][1]["content"]


def test_an_invalid_brief_reply_is_unavailable() -> None:
    api = FakeApi(ok(json.dumps({"vertical": "space-travel"})))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("a rocket", None)


def test_a_non_json_brief_reply_is_unavailable() -> None:
    api = FakeApi(ok("Sure! The founder wants a health app."))

    with pytest.raises(LlmUnavailable):
        api.adapter().extract_brief("a health app", None)


# ---- failure modes: every one becomes LlmUnavailable -------------------------------------------


@pytest.mark.parametrize(
    "respond",
    [
        lambda _r: httpx.Response(500, json={"error": {"code": 500, "message": "boom"}}),
        lambda _r: httpx.Response(401, json={"error": {"code": 401, "message": "bad key"}}),
        lambda _r: httpx.Response(429, json={"error": {"code": 429, "message": "rate limited"}}),
        lambda _r: httpx.Response(200, json={"error": {"code": 502, "message": "upstream"}}),
        lambda _r: httpx.Response(200, json={"choices": []}),
        lambda _r: httpx.Response(200, text="<html>not json</html>"),
        ok("half a sent", finish_reason="length"),
        ok("", finish_reason="content_filter"),
        ok("", finish_reason="error"),
        ok("   "),
    ],
    ids=[
        "http-500",
        "http-401",
        "http-429",
        "error-in-200",
        "no-choices",
        "not-json",
        "truncated",
        "filtered",
        "finish-error",
        "empty",
    ],
)
def test_provider_failures_raise_llm_unavailable(
    respond: Callable[[httpx.Request], httpx.Response],
) -> None:
    api = FakeApi(respond)

    with pytest.raises(LlmUnavailable):
        api.adapter().explain_route(ROUTE)


def test_a_transport_error_is_unavailable() -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route to host", request=request)

    with pytest.raises(LlmUnavailable):
        FakeApi(boom).adapter().explain_route(ROUTE)


# ---- résumé skill suggestions (D-50) -----------------------------------------------------------


def test_suggest_skills_uses_the_suggest_model_and_a_strict_schema() -> None:
    api = FakeApi(ok(json.dumps({"skills": ["Python", "Rust"]})))

    skills = api.adapter().suggest_skills(RESUME)

    assert skills == ["Python", "Rust"]
    body = api.body()
    assert body["model"] == DEFAULT_SUGGEST_MODEL
    assert (
        body["response_format"]["json_schema"]["schema"]["properties"]["skills"]["type"] == "array"
    )


@pytest.mark.parametrize(
    "respond",
    [
        lambda _r: httpx.Response(500, json={"error": {"message": RESUME}}),
        ok("not json at all"),
    ],
    ids=["http-500", "invalid-reply"],
)
def test_suggest_skills_errors_never_carry_the_resume(
    respond: Callable[[httpx.Request], httpx.Response],
) -> None:
    api = FakeApi(respond)

    with pytest.raises(LlmUnavailable) as caught:
        api.adapter().suggest_skills(RESUME)

    error = caught.value
    assert "Jane" not in str(error) and "jane@example.com" not in str(error)
    assert error.__cause__ is None and error.__suppress_context__


# ---- construction from settings ----------------------------------------------------------------


def test_from_settings_requires_a_key() -> None:
    with pytest.raises(LlmUnavailable):
        OpenRouterAdapter.from_settings(
            Settings(llm_provider="openrouter", openrouter_api_key=None)
        )


def test_from_settings_sends_the_bearer_key_and_the_configured_models() -> None:
    settings = Settings(
        llm_provider="openrouter",
        openrouter_api_key="sk-or-v1-abc123",
        openrouter_model="google/gemini-3-pro",
        openrouter_suggest_model="google/gemini-3-flash",
    )

    adapter = OpenRouterAdapter.from_settings(settings)

    assert adapter.client.headers["Authorization"] == "Bearer sk-or-v1-abc123"
    assert adapter.client.headers["X-OpenRouter-Title"] == "Venture Route"
    assert str(adapter.client.base_url).rstrip("/") == BASE_URL
    assert adapter.model == "google/gemini-3-pro"
    assert adapter.suggest_model == "google/gemini-3-flash"
