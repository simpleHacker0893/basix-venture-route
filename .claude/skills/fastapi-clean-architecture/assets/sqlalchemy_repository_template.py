"""SQLAlchemy async repository template.

Reglas:
- Implementa el Protocol <Entity>Repository de domain/ports.py.
- Mappers _to_domain / _to_orm explícitos.
- NO devolver objetos ORM al use case; siempre entidades de domain.
- La sesión la inyecta FastAPI via Depends con yield (ver deps_template.py).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import DeclarativeBase

from app.modules.<feature>.domain.entities import <Entity>


class Base(DeclarativeBase):
    pass


class <Entity>ORM(Base):
    __tablename__ = "<entity_plural>"

    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str]
    created_at: Mapped["datetime"]


class SqlAlchemy<Entity>Repository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, entity_id: str) -> <Entity> | None:
        row = await self._session.get(<Entity>ORM, entity_id)
        return self._to_domain(row) if row else None

    async def get_by_email(self, email: str) -> <Entity> | None:
        stmt = select(<Entity>ORM).where(<Entity>ORM.email == email)
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        return self._to_domain(row) if row else None

    async def save(self, entity: <Entity>) -> None:
        orm = self._to_orm(entity)
        await self._session.merge(orm)
        await self._session.flush()

    async def delete(self, entity_id: str) -> None:
        row = await self._session.get(<Entity>ORM, entity_id)
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()

    @staticmethod
    def _to_domain(row: <Entity>ORM) -> <Entity>:
        return <Entity>(
            id=row.id,
            email=row.email,
            name=row.name,
            created_at=row.created_at,
        )

    @staticmethod
    def _to_orm(entity: <Entity>) -> <Entity>ORM:
        return <Entity>ORM(
            id=entity.id,
            email=entity.email,
            name=entity.name,
            created_at=entity.created_at,
        )
