"""OpenRouterAdapter: the second LlmAdapter (D-53), selected by `LLM_PROVIDER=openrouter`.

Every call is `POST /chat/completions` on the OpenRouter API through one `httpx.Client` with a
bearer key and a 20 s timeout. Intake calls (`extract_brief`, `suggest_skills`) use the intake
model with reasoning off and a strict `json_schema` response format, and the reply is validated
against the same Pydantic model. `explain_route` uses the explain model with reasoning on and
receives the route with every reasoning path's raw `facts` removed (PRD §5.7).

The prompts, `SuggestedSkills` and `FACTS_EXCLUDED` are the Anthropic adapter's, imported rather
than copied, so both providers stay on one LLM boundary. The key and models come from settings
(`.env`, D-26) and nowhere else.

Every failure (transport error, timeout, non-2xx status, a `length` or `content_filter` finish,
an empty or unparsable body, a schema error) raises `LlmUnavailable` with a fixed message
`from None`, outside any `except` block, so neither the input (a résumé is personal data, D-50)
nor the upstream reply or error can reach a log line or the exception chain.
"""

from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.llm.anthropic_adapter import (
    EXPLANATION_INSTRUCTION,
    EXTRACTION_INSTRUCTION,
    SUGGEST_INSTRUCTION,
    AnthropicAdapter,
    SuggestedSkills,
)
from app.llm.base import ExtractedBrief, LlmUnavailable
from app.models.chat import PartialBrief
from app.models.route import VentureRoute

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 20.0
COMPLETIONS_PATH = "/chat/completions"
# Finish reasons that mean the reply is cut short or withheld.
INCOMPLETE_FINISH_REASONS = frozenset({"length", "content_filter"})

ModelT = TypeVar("ModelT", bound=BaseModel)


class OpenRouterAdapter:
    name = "openrouter"

    def __init__(self, client: httpx.Client, intake_model: str, explain_model: str) -> None:
        self.client = client
        self.intake_model = intake_model
        self.explain_model = explain_model

    @classmethod
    def from_settings(cls, settings: Settings) -> OpenRouterAdapter:
        key = settings.openrouter_api_key
        intake = settings.openrouter_intake_model
        explain = settings.openrouter_explain_model
        if not key or not intake or not explain:
            raise LlmUnavailable("OpenRouter key or models are not set")
        client = httpx.Client(
            base_url=settings.openrouter_base_url,
            timeout=TIMEOUT_SECONDS,
            headers={"Authorization": f"Bearer {key}"},
        )
        return cls(client, intake_model=intake, explain_model=explain)

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        # mode="json" renders dates as ISO strings, as in the Anthropic adapter.
        known = current.model_dump(mode="json", by_alias=True, exclude_none=True) if current else {}
        prompt = (
            f"Fields already confirmed (JSON, for context only):\n{json.dumps(known)}\n\n"
            f"Founder message:\n{message}"
        )
        return self._structured(EXTRACTION_INSTRUCTION, prompt, ExtractedBrief, "extracted_brief")

    def explain_route(self, route: VentureRoute) -> str:
        payload = route.model_dump(by_alias=True, exclude=AnthropicAdapter.FACTS_EXCLUDED)
        content = self._complete(
            {
                "model": self.explain_model,
                "messages": _messages(EXPLANATION_INSTRUCTION, json.dumps(payload, indent=2)),
                "reasoning": {"enabled": True},
            }
        )
        text = content.strip()
        if not text:
            raise LlmUnavailable("openrouter explanation was empty") from None
        return text

    def suggest_skills(self, text: str) -> list[str]:
        prompt = f"Résumé:\n{text}"
        parsed = self._structured(SUGGEST_INSTRUCTION, prompt, SuggestedSkills, "suggested_skills")
        return parsed.skills

    def _structured(self, system: str, user: str, model: type[ModelT], schema_name: str) -> ModelT:
        content = self._complete(
            {
                "model": self.intake_model,
                "messages": _messages(system, user),
                "reasoning": {"enabled": False},
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema_name,
                        "strict": True,
                        "schema": model.model_json_schema(),
                    },
                },
            }
        )
        parsed: ModelT | None
        try:
            parsed = model.model_validate_json(content)
        except ValidationError:  # invalid JSON or a schema error; never chained, never logged
            parsed = None
        if parsed is None:
            log.warning("openrouter returned a reply that does not match %s", model.__name__)
            raise LlmUnavailable("openrouter returned an invalid reply") from None
        return parsed

    def _complete(self, body: dict[str, Any]) -> str:
        """The reply's message content, or `LlmUnavailable` with a fixed message."""
        response: httpx.Response | None
        try:
            response = self.client.post(COMPLETIONS_PATH, json=body)
        except httpx.HTTPError:
            response = None
        if response is None:
            log.warning("openrouter request failed before a reply")
            raise LlmUnavailable("openrouter request failed") from None
        if not response.is_success:
            log.warning("openrouter answered HTTP %d", response.status_code)
            raise LlmUnavailable("openrouter answered an error status") from None
        content, finish_reason = _first_choice(response)
        if finish_reason in INCOMPLETE_FINISH_REASONS:
            log.warning("openrouter reply was incomplete (finish_reason=%s)", finish_reason)
            raise LlmUnavailable("openrouter reply was incomplete") from None
        if content is None:
            log.warning("openrouter reply had no message content")
            raise LlmUnavailable("openrouter reply was empty") from None
        return content


def _messages(system: str, user: str) -> list[dict[str, str]]:
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _first_choice(response: httpx.Response) -> tuple[str | None, str | None]:
    """`choices[0].message.content` and `choices[0].finish_reason`, each None when absent.

    Never raises: a body of the wrong shape reads as no content.
    """
    try:
        data = response.json()
    except ValueError:
        return None, None
    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return None, None
    choice = choices[0]
    finish = choice.get("finish_reason")
    message = choice.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    return (
        content if isinstance(content, str) else None,
        finish if isinstance(finish, str) else None,
    )
