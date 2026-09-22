"""Pydantic Settings template.

Reglas:
- Settings es un BaseSettings con type hints; lee .env y env vars.
- get_settings() está cacheado con @lru_cache.
- Acceso via Depends(get_settings) para que tests puedan sobrescribir.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "fastapi-clean-app"
    environment: str = Field(default="local", pattern="^(local|dev|staging|prod)$")
    debug: bool = False

    # Mongo
    mongo_uri: str
    mongo_db_name: str

    # Celery (opcional)
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None

    # Auth
    clerk_jwks_url: str | None = None
    clerk_authorized_parties: list[str] = Field(default_factory=list)
    api_key_pepper: str | None = None

    @property
    def api_key_pepper_bytes(self) -> bytes | None:
        return self.api_key_pepper.encode("utf-8") if self.api_key_pepper else None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


# Uso como dependencia FastAPI:
#
# from fastapi import Depends
# from app.core.config import Settings, get_settings
#
# def get_mongo_uri(settings: Settings = Depends(get_settings)) -> str:
#     return settings.mongo_uri
