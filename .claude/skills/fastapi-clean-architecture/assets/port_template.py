"""Repository port (Protocol) template.

Reglas:
- Protocol vive en domain/ports.py.
- Métodos async coinciden 1:1 con las llamadas del use case.
- NO importar bson, sqlalchemy, pymongo. Solo entidades de domain.
"""

from typing import Protocol

from app.modules.<feature>.domain.entities import <Entity>


class <Entity>Repository(Protocol):
    async def get_by_id(self, entity_id: str) -> <Entity> | None: ...

    async def get_by_email(self, email: str) -> <Entity> | None: ...

    async def save(self, entity: <Entity>) -> None: ...

    async def delete(self, entity_id: str) -> None: ...
