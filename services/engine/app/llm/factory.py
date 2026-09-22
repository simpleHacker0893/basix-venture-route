"""Adapter selection from settings (D-06, D-26).

`ANTHROPIC_API_KEY` unset, or `LLM_PROVIDER=null`, or a provider with no registered adapter,
all select `NullAdapter`; the API never fails for lack of a key.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from app.config import Settings
from app.llm.anthropic_adapter import AnthropicAdapter
from app.llm.base import LlmAdapter
from app.llm.null_adapter import NullAdapter

log = logging.getLogger(__name__)

AdapterFactory = Callable[[Settings], LlmAdapter]

# Providers that need a key register here; "null" needs nothing.
KEYED_ADAPTERS: dict[str, AdapterFactory] = {"anthropic": AnthropicAdapter.from_settings}


def select_adapter(settings: Settings) -> LlmAdapter:
    provider = settings.llm_provider
    if provider == "null":
        return NullAdapter()
    if not settings.anthropic_api_key:
        log.info("ANTHROPIC_API_KEY unset; using NullAdapter")
        return NullAdapter()
    factory = KEYED_ADAPTERS.get(provider)
    if factory is None:
        log.warning("no adapter registered for LLM_PROVIDER=%s; using NullAdapter", provider)
        return NullAdapter()
    return factory(settings)
