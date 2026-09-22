"""FastAPI dependencies (providers) template.

Reglas:
- Cada provider devuelve UNA cosa: session, repo, use case.
- Yield para recursos que necesitan cleanup (DB session).
- El use case provider compone repo + clientes; el router solo recibe el use case.
"""

from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from pymongo.asynchronous.database import AsyncDatabase
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.<feature>.application.use_cases import (
    Create<Entity>UseCase,
    Get<Entity>UseCase,
)
from app.modules.<feature>.domain.ports import <Entity>Repository
from app.modules.<feature>.infrastructure.repositories import (
    Mongo<Entity>Repository,
    # SqlAlchemy<Entity>Repository,
)


# --- Database providers ---


def get_db(request: Request) -> AsyncDatabase:
    """Mongo: app.state.db viene del lifespan."""
    return request.app.state.db


async def get_sql_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """SQL: yield para asegurar cleanup."""
    session_maker: async_sessionmaker = request.app.state.session_maker
    async with session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# --- Repository providers ---


def get_<entity>_repository(db: AsyncDatabase = Depends(get_db)) -> <Entity>Repository:
    return Mongo<Entity>Repository(db)


# --- Use case providers ---


def get_create_<entity>_use_case(
    repo: <Entity>Repository = Depends(get_<entity>_repository),
) -> Create<Entity>UseCase:
    return Create<Entity>UseCase(repo=repo)


def get_get_<entity>_use_case(
    repo: <Entity>Repository = Depends(get_<entity>_repository),
) -> Get<Entity>UseCase:
    return Get<Entity>UseCase(repo=repo)
