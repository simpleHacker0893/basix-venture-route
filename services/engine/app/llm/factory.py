"""Adapter selection from settings (D-06, D-26, D-53).

`LLM_PROVIDER=null`, a provider with no registered adapter, or a keyed provider whose own
settings are missing all select `NullAdapter`; the API never fails for lack of a key. Each keyed
provider checks only its own settings: `anthropic` needs `ANTHROPIC_API_KEY`; `openrouter` needs
`OPENROUTER_API_KEY`, `OPENROUTER_INTAKE_MODEL` and `OPENROUTER_EXPLAIN_MODEL`. A missing
setting is logged by name, never by value.
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
# The names of the provider's required settings that are unset; empty means ready.
MissingSettings = Callable[[Settings], list[str]]


def _missing_anthropic(settings: Settings) -> list[str]:
    return [] if settings.anthropic_api_key else ["ANTHROPIC_API_KEY"]


def _missing_openrouter(settings: Settings) -> list[str]:
    required = {
        "OPENROUTER_API_KEY": settings.openrouter_api_key,
        "OPENROUTER_INTAKE_MODEL": settings.openrouter_intake_model,
        "OPENROUTER_EXPLAIN_MODEL": settings.openrouter_explain_model,
    }
    return [name for name, value in required.items() if not value]


# Providers that need a key register here with their settings check; "null" needs nothing.
KEYED_ADAPTERS: dict[str, tuple[MissingSettings, AdapterFactory]] = {
    "anthropic": (_missing_anthropic, AnthropicAdapter.from_settings),
    "openrouter": (_missing_openrouter, OpenRouterAdapter.from_settings),
}


def select_adapter(settings: Settings) -> LlmAdapter:
    provider = settings.llm_provider
    if provider == "null":
        return NullAdapter()
    entry = KEYED_ADAPTERS.get(provider)
    if entry is None:
        log.warning("no adapter registered for LLM_PROVIDER=%s; using NullAdapter", provider)
        return NullAdapter()
    missing_settings, factory = entry
    missing = missing_settings(settings)
    if missing:
        log.info("%s unset; using NullAdapter", ", ".join(missing))
        return NullAdapter()
    return factory(settings)
