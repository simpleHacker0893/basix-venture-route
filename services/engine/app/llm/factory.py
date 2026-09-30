"""Adapter selection from settings (D-06, D-26).

`LLM_PROVIDER=null`, a provider with no registered adapter, or the selected provider's own key
unset (`ANTHROPIC_API_KEY` for anthropic, `OPENROUTER_API_KEY` for openrouter) all select
`NullAdapter`; the API never fails for lack of a key.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from app.config import Settings
from app.llm.anthropic_adapter import AnthropicAdapter
from app.llm.base import LlmAdapter
from app.llm.null_adapter import NullAdapter
from app.llm.openrouter_adapter import OpenRouterAdapter

log = logging.getLogger(__name__)

AdapterFactory = Callable[[Settings], LlmAdapter]

# Providers that need a key register here with the setting that holds it; "null" needs nothing.
KEYED_ADAPTERS: dict[str, tuple[str, AdapterFactory]] = {
    "anthropic": ("anthropic_api_key", AnthropicAdapter.from_settings),
    "openrouter": ("openrouter_api_key", OpenRouterAdapter.from_settings),
}


def select_adapter(settings: Settings) -> LlmAdapter:
    provider = settings.llm_provider
    if provider == "null":
        return NullAdapter()
    registered = KEYED_ADAPTERS.get(provider)
    if registered is None:
        log.warning("no adapter registered for LLM_PROVIDER=%s; using NullAdapter", provider)
        return NullAdapter()
    key_field, factory = registered
    if not getattr(settings, key_field):
        log.info("%s unset; using NullAdapter", key_field.upper())
        return NullAdapter()
    return factory(settings)
