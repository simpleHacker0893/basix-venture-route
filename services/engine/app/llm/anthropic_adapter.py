"""AnthropicAdapter: the real LlmAdapter (D-06) behind the same protocol as NullAdapter.

Official `anthropic` SDK only (no raw HTTP), model `claude-opus-5`, structured output through
`output_config.format` for intake, and the verbatim DOMAIN.md system instruction for the
summary call. The summary call receives the structured route with every reasoning path's raw
`facts` removed, so no graph atom ever leaves the process (PRD §5.7). Any SDK error, timeout,
refusal or unparsable reply raises `LlmUnavailable`; the orchestrator then behaves like
NullAdapter. The key is read from settings (`ANTHROPIC_API_KEY` in .env, D-26) and nowhere else.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.config import Settings
from app.llm.base import SYSTEM_INSTRUCTION, ExtractedBrief, LlmUnavailable
from app.models.chat import PartialBrief
from app.models.route import VentureRoute

log = logging.getLogger(__name__)

MODEL = "claude-opus-5"
MAX_TOKENS = 4096
TIMEOUT_SECONDS = 20.0
MAX_RETRIES = 2

EXTRACTION_INSTRUCTION = (
    SYSTEM_INSTRUCTION
    + "\n\nYou extract venture brief fields from a founder's message. Return only values the "
    "founder states explicitly in the latest message; leave every other field null. Never "
    "infer, guess or complete a field. Skills must be chosen from: python, ai-metta, ui-ux, "
    "frontend, backend, domain-research, mobile, rust, data. Verticals: health, agri, "
    "education. Delivery modes: remote, hybrid, on-site. Dates are ISO YYYY-MM-DD. Budget is "
    "an integer in USD per day."
)

EXPLANATION_INSTRUCTION = (
    SYSTEM_INSTRUCTION
    + "\n\nWrite two or three plain sentences for a founder that summarise the route JSON you "
    "are given. Name only the builders, reusable IP, cohort and partner that appear in it, and "
    "state the total daily rate as given. If `gaps` is not empty, explain each gap in one "
    "sentence and restate only its `nextActions`. Do not add recommendations of your own."
)


class AnthropicAdapter:
    name = "anthropic"

    # Reasoning-path `facts` are raw graph atoms; they never reach the model.
    FACTS_EXCLUDED: dict[str, Any] = {
        "builders": {"__all__": {"evidence_paths": {"__all__": {"facts": True}}}},
        "reusable_ip": {"path": {"facts": True}},
        "cohort": {"path": {"facts": True}},
        "partner": {"path": {"facts": True}},
    }

    def __init__(self, client: anthropic.Anthropic) -> None:
        self.client = client

    @classmethod
    def from_settings(cls, settings: Settings) -> AnthropicAdapter:
        if not settings.anthropic_api_key:
            raise LlmUnavailable("ANTHROPIC_API_KEY is not set")
        return cls(
            anthropic.Anthropic(
                api_key=settings.anthropic_api_key,
                timeout=TIMEOUT_SECONDS,
                max_retries=MAX_RETRIES,
            )
        )

    def extract_brief(self, message: str, current: PartialBrief | None) -> ExtractedBrief:
        known = current.model_dump(by_alias=True, exclude_none=True) if current else {}
        prompt = (
            f"Fields already confirmed (JSON, for context only):\n{json.dumps(known)}\n\n"
            f"Founder message:\n{message}"
        )
        try:
            response = self.client.messages.parse(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=EXTRACTION_INSTRUCTION,
                messages=[{"role": "user", "content": prompt}],
                output_format=ExtractedBrief,
            )
            _require_completed(response.stop_reason)
            parsed = response.parsed_output
        except anthropic.APIError as exc:
            raise LlmUnavailable(f"anthropic extraction failed: {exc.__class__.__name__}") from exc
        except ValueError as exc:  # invalid JSON or an ExtractedBrief validation error
            raise LlmUnavailable("anthropic extraction returned an invalid brief") from exc
        if parsed is None:
            raise LlmUnavailable("anthropic extraction returned no structured output")
        return parsed

    def explain_route(self, route: VentureRoute) -> str:
        payload = route.model_dump(by_alias=True, exclude=self.FACTS_EXCLUDED)
        try:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=EXPLANATION_INSTRUCTION,
                messages=[{"role": "user", "content": json.dumps(payload, indent=2)}],
            )
        except anthropic.APIError as exc:
            raise LlmUnavailable(f"anthropic explanation failed: {exc.__class__.__name__}") from exc
        _require_completed(response.stop_reason)
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise LlmUnavailable("anthropic explanation was empty")
        return text


def _require_completed(stop_reason: str | None) -> None:
    if stop_reason == "refusal":
        raise LlmUnavailable("anthropic declined the request")
    if stop_reason == "max_tokens":
        raise LlmUnavailable("anthropic reply was truncated")
