"""Settings (pydantic-settings). Read from environment and an optional .env file."""

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_ROOT.parent.parent

# The value shipped in .env.example. A verbatim copy of the example must behave as "no key"
# (Sprint 002 #22, review.md finding 5) so no doomed Anthropic call is ever made.
PLACEHOLDER_ANTHROPIC_API_KEY = "sk-ant-replace-me"

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:4173"


class Settings(BaseSettings):
    """Reads the repo-root `.env` (where the Operator places every key, D-26), then an optional
    `services/engine/.env` that overrides it, then the process environment on top."""

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", PACKAGE_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Demo clock frozen for deterministic availability windows (D-14).
    demo_today: date = date(2026, 9, 22)
    # Minimum overlap between a builder interval and the brief window, in days (D-08).
    min_overlap_days: int = 2
    # Enables POST /internal/query. Never on in a deployed engine.
    engine_dev_query: bool = False
    engine_port: int = 8000
    # Directory holding facts.metta, rules.metta and briefs.json.
    seed_dir: Path = PACKAGE_ROOT / "seed"
    # LLM adapter (D-06, D-26). The key arrives through .env only; unset means NullAdapter.
    llm_provider: Literal["anthropic", "null"] = "anthropic"
    anthropic_api_key: str | None = None
    # Browser origins allowed to call the engine, comma-separated (D-30). Credentials stay off
    # in Sprint 002; Sprint 005 adds the Vercel origin on the host.
    cors_origins: str = DEFAULT_CORS_ORIGINS

    @field_validator("anthropic_api_key", mode="before")
    @classmethod
    def _placeholder_means_unset(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() in ("", PLACEHOLDER_ANTHROPIC_API_KEY):
            return None
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
