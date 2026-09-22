"""FastAPI lifespan template.

Reglas:
- Recursos costosos (DB clients, JWKS, modelos ML) se inicializan acá, no en import time.
- Verificación (ping) antes de yield.
- Cleanup en finally.
- app.state guarda referencias accesibles via Request.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import AsyncMongoClient
from pymongo.errors import ConnectionFailure

from app.core.config import get_settings
from app.modules.<feature>.infrastructure.mongo_indexes import ensure_<feature>_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    client = AsyncMongoClient(
        settings.mongo_uri,
        appname=settings.app_name,
        serverSelectionTimeoutMS=5_000,
        connectTimeoutMS=5_000,
        socketTimeoutMS=10_000,
        maxPoolSize=100,
        uuidRepresentation="standard",
    )

    try:
        await client.admin.command("ping")
    except ConnectionFailure:
        await client.close()
        raise

    app.state.mongo_client = client
    app.state.db = client[settings.mongo_db_name]

    # Garantizar invariantes de infraestructura
    await ensure_<feature>_indexes(app.state.db)

    try:
        yield
    finally:
        await client.close()


# Uso en main.py:
# app = FastAPI(lifespan=lifespan)
