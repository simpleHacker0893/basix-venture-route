"""Alembic environment: async migrations over asyncpg (D-17).

URL resolution, fixed in spec #35: ALEMBIC_DATABASE_URL, then DATABASE_URL_DIRECT, then
DATABASE_URL. Conftest sets the first to TEST_DATABASE_URL; the Operator sets the direct
(unpooled) URL for Neon; compose and CI have one plain URL for their local postgres:18 (D-37).
"""

import asyncio
import os

from alembic import context
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

from app.config import get_settings
from app.marketplace import models  # noqa: F401  (registers every table on SQLModel.metadata)

config = context.config
target_metadata = SQLModel.metadata


def resolve_url() -> str:
    url = os.environ.get("ALEMBIC_DATABASE_URL") or get_settings().alembic_url
    if not url:
        raise RuntimeError(
            "no database URL: set ALEMBIC_DATABASE_URL, DATABASE_URL_DIRECT or DATABASE_URL"
        )
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=resolve_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(resolve_url(), poolclass=None)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(do_run_migrations)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
