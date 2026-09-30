"""OpenRouterAdapter: the LlmAdapter for LLM_PROVIDER=openrouter, behind the same protocol.

OpenRouter exposes an OpenAI-compatible chat-completions API over plain HTTPS, so this adapter
uses `httpx` (already an engine dependency) rather than adding an SDK. It keeps the Anthropic
adapter's boundary exactly: the same prompts with the verbatim DOMAIN.md system instruction,
structured output for intake and résumé skills, and the summary call receives the structured
route with every reasoning path's raw `facts` removed, so no graph atom leaves the process
(PRD §5.7). Any HTTP error, error body, truncated or filtered reply, or unparsable output raises
`LlmUnavailable`; the orchestrator then behaves like NullAdapter.

The key is read from settings (`OPENROUTER_API_KEY` in .env, D-26) and nowhere else. Models are
OpenRouter slugs from settings; the defaults are the Claude models D-06 names. Structured-output
requests set `provider.require_parameters` so OpenRouter routes them only to providers that honour
the JSON schema, and the reply is still validated here with Pydantic.

Résumé skill suggestions (D-50) use their own model and a short, single-attempt call. The résumé
text is personal data: every error raised from `suggest_skills` is re-raised `from None` with a
fixed message so no provider body (which may quote the prompt) is chained onto it.
"""

from __future__ import annotations

import json
import logging
from typing import Any

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

BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "anthropic/claude-opus-5"
DEFAULT_SUGGEST_MODEL = "anthropic/claude-haiku-4.5"
APP_TITLE = "Venture Route"
MAX_TOKENS = 4096
TIMEOUT_SECONDS = 20.0
CONNECT_RETRIES = 2
SUGGEST_MAX_TOKENS = 1024
SUGGEST_TIMEOUT_SECONDS = 10.0


class OpenRouterAdapter:
    name = "openrouter"

    # Reasoning-path `facts` are raw graph atoms; they never reach the model.
    FACTS_EXCLUDED = AnthropicAdapter.FACTS_EXCLUDED

    def __init__(
        self,
        client: httpx.Client,
        model: str = DEFAULT_MODEL,
        suggest_model: str = DEFAULT_SUGGEST_MODEL,
    ) -> None:
        self.client = client
        self.model = model
        self.suggest_model = suggest_model

    @classmethod
    def from_settings(cls, settings: Settings) -> OpenRouterAdapter:
        if not settings.openrouter_api_key:
            raise LlmUnavailable("OPENROUTER_API_KEY is not set")
        client = httpx.Client(
            base_url=BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                # Optional attribution header; names the app on openrouter.ai.
                "X-OpenRouter-Title": APP_TITLE,
            },
            timeout=TIMEOUT_SECONDS,
            transport=httpx.HTTPTransport(retries=CONNECT_RETRIES),
        )
        return cls(client, settings.openrouter_model, settings.openrouter_suggest_model)

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        # mode="json" renders dates as ISO strings for the context block.
        known = current.model_dump(mode="json", by_alias=True, exclude_none=True) if current else {}
        prompt = (
            f"Fields already confirmed (JSON, for context only):\n{json.dumps(known)}\n\n"
            f"Founder message:\n{message}"
        )
        content = self._complete(
            model=self.model,
            system=EXTRACTION_INSTRUCTION,
            user=prompt,
            max_tokens=MAX_TOKENS,
            schema=("extracted_brief", ExtractedBrief),
        )
        try:
            return ExtractedBrief.model_validate_json(_strip_fence(content))
        except ValidationError as exc:
            raise LlmUnavailable("openrouter extraction returned an invalid brief") from exc

    def explain_route(self, route: VentureRoute) -> str:
        payload = route.model_dump(by_alias=True, exclude=self.FACTS_EXCLUDED)
        return self._complete(
            model=self.model,
            system=EXPLANATION_INSTRUCTION,
            user=json.dumps(payload, indent=2),
            max_tokens=MAX_TOKENS,
        )

    def suggest_skills(self, text: str) -> list[str]:
        # `from None` everywhere: the résumé must never reach a log line or a traceback.
        try:
            content = self._complete(
                model=self.suggest_model,
                system=SUGGEST_INSTRUCTION,
                user=f"Résumé:\n{text}",
                max_tokens=SUGGEST_MAX_TOKENS,
                schema=("suggested_skills", SuggestedSkills),
                timeout=SUGGEST_TIMEOUT_SECONDS,
            )
            parsed = SuggestedSkills.model_validate_json(_strip_fence(content))
        except LlmUnavailable:
            raise LlmUnavailable("openrouter suggestion failed") from None
        except ValidationError:
            raise LlmUnavailable("openrouter suggestion returned an invalid reply") from None
        return parsed.skills

    def _complete(
        self,
        *,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        schema: tuple[str, type[BaseModel]] | None = None,
        timeout: float | None = None,
    ) -> str:
        """One chat completion; returns the assistant text or raises LlmUnavailable."""
        body: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if schema is not None:
            name, shape = schema
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": name,
                    "strict": False,
                    "schema": shape.model_json_schema(by_alias=True),
                },
            }
            body["provider"] = {"require_parameters": True}
        try:
            response = self.client.post(
                "/chat/completions",
                json=body,
                timeout=timeout if timeout is not None else httpx.USE_CLIENT_DEFAULT,
            )
        except httpx.HTTPError as exc:
            raise LlmUnavailable(f"openrouter request failed: {type(exc).__name__}") from None
        if response.status_code != httpx.codes.OK:
            raise LlmUnavailable(f"openrouter answered HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError:
            raise LlmUnavailable("openrouter answered a non-JSON body") from None
        if not isinstance(data, dict) or "error" in data:
            raise LlmUnavailable("openrouter answered an error")
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            raise LlmUnavailable("openrouter answered no choices")
        choice = choices[0]
        finish = choice.get("finish_reason")
        if choice.get("error") or finish == "error":
            raise LlmUnavailable("openrouter provider errored")
        if finish == "length":
            raise LlmUnavailable("openrouter reply was truncated")
        if finish == "content_filter":
            raise LlmUnavailable("openrouter declined the request")
        message = choice.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise LlmUnavailable("openrouter reply was empty")
        return content.strip()


def _strip_fence(content: str) -> str:
    """Some models wrap JSON in a Markdown code fence even when asked for a schema."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()
