"""Seam: adapter selection from settings (D-26; Sprint 002 #22, review.md finding 5)."""

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


# ---- LLM_PROVIDER=openrouter ------------------------------------------------------------------


def test_openrouter_with_a_key_selects_the_openrouter_adapter() -> None:
    adapter = select_adapter(Settings(llm_provider="openrouter", openrouter_api_key="sk-or-v1-abc"))

    assert isinstance(adapter, OpenRouterAdapter)


def test_the_openrouter_placeholder_key_selects_the_null_adapter() -> None:
    settings = Settings(
        llm_provider="openrouter", openrouter_api_key=PLACEHOLDER_OPENROUTER_API_KEY
    )

    assert settings.openrouter_api_key is None
    assert isinstance(select_adapter(settings), NullAdapter)


def test_each_provider_needs_its_own_key() -> None:
    only_anthropic = Settings(
        llm_provider="openrouter", anthropic_api_key="sk-ant-abc", openrouter_api_key=None
    )
    only_openrouter = Settings(
        llm_provider="anthropic", anthropic_api_key=None, openrouter_api_key="sk-or-v1-abc"
    )

    assert isinstance(select_adapter(only_anthropic), NullAdapter)
    assert isinstance(select_adapter(only_openrouter), NullAdapter)


def test_openrouter_placeholder_matches_env_example() -> None:
    example = (Settings().seed_dir.parents[2] / ".env.example").read_text(encoding="utf-8")

    assert f"OPENROUTER_API_KEY={PLACEHOLDER_OPENROUTER_API_KEY}" in example
