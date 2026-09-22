"""Settings (pydantic-settings). Read from environment and an optional .env file."""

from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Demo clock frozen for deterministic availability windows (D-14).
    demo_today: date = date(2026, 9, 22)
    # Minimum overlap between a builder interval and the brief window, in days (D-08).
    min_overlap_days: int = 2
    # Enables POST /internal/query. Never on in a deployed engine.
    engine_dev_query: bool = False
    engine_port: int = 8000
    # Directory holding facts.metta, rules.metta and briefs.json.
    seed_dir: Path = PACKAGE_ROOT / "seed"


@lru_cache
def get_settings() -> Settings:
    return Settings()
