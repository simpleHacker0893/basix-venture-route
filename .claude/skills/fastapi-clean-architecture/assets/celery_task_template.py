"""Celery 5.4 task template.

Reglas:
- La task es un ADAPTER: no contiene reglas de negocio, solo orquesta.
- autoretry_for cubre SOLO errores transitorios (red, timeout, rate limit).
- acks_late=True requiere que la task sea idempotente (usar idempotency_key).
- Pasar IDs y JSON pequeños, NUNCA modelos ORM/ODM ni objetos complejos.
- soft_time_limit < time_limit; timeout del cliente HTTP/DB aún más chico.
"""

import asyncio

from app.workers.celery_app import celery_app
from app.modules.<feature>.application.use_cases import <Feature>UseCase
from app.modules.<feature>.application.errors import TransientDependencyError


@celery_app.task(
    name="<feature>.<action>",
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError, TransientDependencyError),
    retry_kwargs={"max_retries": 5},
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    acks_late=True,
    soft_time_limit=30,
    time_limit=60,
)
def <feature>_<action>_task(
    self,
    entity_id: str,
    idempotency_key: str,
) -> dict:
    """Celery adapter: no contiene reglas de negocio."""
    result = asyncio.run(_run(entity_id=entity_id, idempotency_key=idempotency_key))
    return {"status": "ok", "entity_id": result.entity_id}


async def _run(entity_id: str, idempotency_key: str):
    """Composition root del worker. NO importar la FastAPI app."""
    from pymongo import AsyncMongoClient
    from app.core.config import get_settings
    from app.modules.<feature>.infrastructure.repositories import Mongo<Entity>Repository

    settings = get_settings()
    async with AsyncMongoClient(settings.mongo_uri, uuidRepresentation="standard") as client:
        db = client[settings.mongo_db_name]
        repo = Mongo<Entity>Repository(db)
        use_case = <Feature>UseCase(repo=repo)
        return await use_case.execute(entity_id=entity_id, idempotency_key=idempotency_key)
