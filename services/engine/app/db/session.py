"""Async engine and session dependency for the marketplace store (D-17).

Nothing else in the engine opens database connections. The composition root builds the engine
once in the lifespan and places a session factory on `app.state`; tests place their own factory,
bound to a rolled-back connection, in the same place (D-19).
"""

from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

SessionFactory = async_sessionmaker[AsyncSession]

STORE_NOT_CONFIGURED = "marketplace store not configured"


def create_store_engine(database_url: str) -> AsyncEngine:
    """One pooled asyncpg engine for the process; `pool_pre_ping` survives Neon scale-to-zero."""
    return create_async_engine(database_url, pool_pre_ping=True)


def create_session_factory(engine: AsyncEngine) -> SessionFactory:
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. 503 when the store is not configured (placeholder DATABASE_URL, D-26)."""
    factory: SessionFactory | None = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail=STORE_NOT_CONFIGURED)
    async with factory() as session:
        yield session
