"""Seam: adapter selection from settings (D-26; Sprint 002 #22, review.md finding 5)."""

import logging
from typing import Literal

import pytest

from app.config import PLACEHOLDER_ANTHROPIC_API_KEY, PLACEHOLDER_OPENROUTER_API_KEY, Settings
from app.llm.anthropic_adapter import AnthropicAdapter
from app.llm.factory import select_adapter
from app.llm.null_adapter import NullAdapter
from app.llm.openrouter_adapter import OpenRouterAdapter


def test_the_env_example_placeholder_key_selects_the_null_adapter() -> None:
    settings = Settings(llm_provider="anthropic", anthropic_api_key="sk-ant-replace-me")

    assert settings.anthropic_api_key is None
    assert isinstance(select_adapter(settings), NullAdapter)


def test_blank_key_selects_the_null_adapter() -> None:
    assert isinstance(
        select_adapter(Settings(llm_provider="anthropic", anthropic_api_key="   ")), NullAdapter
    )


def test_a_real_looking_key_still_selects_anthropic() -> None:
    adapter = select_adapter(Settings(llm_provider="anthropic", anthropic_api_key="sk-ant-abc123"))

    assert isinstance(adapter, AnthropicAdapter)


def test_placeholder_constant_matches_env_example() -> None:
    example = (Settings().seed_dir.parents[2] / ".env.example").read_text(encoding="utf-8")

    assert f"ANTHROPIC_API_KEY={PLACEHOLDER_ANTHROPIC_API_KEY}" in example


# ---- OpenRouter (D-53): each keyed provider checks only its own key ---------------------------

INTAKE = "nvidia/intake-test"
EXPLAIN = "openai/explain-test"


def openrouter_settings(
    *,
    llm_provider: Literal["anthropic", "openrouter", "null"] = "openrouter",
    anthropic_api_key: str = "",
    openrouter_api_key: str = "sk-or-abc123",
    intake: str = INTAKE,
    explain: str = EXPLAIN,
) -> Settings:
    """Every LLM setting explicit, so a developer's real `.env` never leaks into the case."""
    return Settings(
        llm_provider=llm_provider,
        anthropic_api_key=anthropic_api_key,
        openrouter_api_key=openrouter_api_key,
        openrouter_intake_model=intake,
        openrouter_explain_model=explain,
    )


def test_openrouter_placeholder_key_selects_the_null_adapter() -> None:
    settings = openrouter_settings(openrouter_api_key="sk-or-replace-me")

    assert settings.openrouter_api_key is None
    assert isinstance(select_adapter(settings), NullAdapter)


def test_openrouter_blank_key_selects_the_null_adapter() -> None:
    settings = openrouter_settings(openrouter_api_key="  ")

    assert isinstance(select_adapter(settings), NullAdapter)


def test_openrouter_real_looking_key_and_models_select_openrouter() -> None:
    adapter = select_adapter(openrouter_settings())

    assert isinstance(adapter, OpenRouterAdapter)
    assert adapter.intake_model == INTAKE
    assert adapter.explain_model == EXPLAIN


@pytest.mark.parametrize("missing", ["openrouter_intake_model", "openrouter_explain_model"])
def test_openrouter_missing_model_selects_the_null_adapter_and_logs_why(
    missing: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    if missing == "openrouter_intake_model":
        settings = openrouter_settings(intake="   ")
    else:
        settings = openrouter_settings(explain="   ")

    assert getattr(settings, missing) is None
    assert isinstance(select_adapter(settings), NullAdapter)
    assert missing.upper() in caplog.text


def test_openrouter_key_does_not_enable_anthropic() -> None:
    settings = openrouter_settings(llm_provider="anthropic", anthropic_api_key="")

    assert isinstance(select_adapter(settings), NullAdapter)


def test_anthropic_key_does_not_enable_openrouter() -> None:
    settings = openrouter_settings(anthropic_api_key="sk-ant-abc123", openrouter_api_key="")

    assert isinstance(select_adapter(settings), NullAdapter)


def test_openrouter_placeholder_constant_matches_env_example() -> None:
    example = (Settings().seed_dir.parents[2] / ".env.example").read_text(encoding="utf-8")

    assert f"OPENROUTER_API_KEY={PLACEHOLDER_OPENROUTER_API_KEY}" in example
