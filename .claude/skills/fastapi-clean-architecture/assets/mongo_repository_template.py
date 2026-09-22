"""PyMongo async repository template.

Reglas:
- Implementa el Protocol <Entity>Repository de domain/ports.py.
- Mappers _to_domain / _to_document explícitos.
- ObjectId, nombres de colecciones, operadores Mongo ($set, $setOnInsert) viven SOLO acá.
- NO importar bson en domain ni application.
"""

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.modules.<feature>.domain.entities import <Entity>


class Mongo<Entity>Repository:
    COLLECTION = "<entity_plural>"

    def __init__(self, db: AsyncDatabase):
        self._collection = db[self.COLLECTION]

    async def get_by_id(self, entity_id: str) -> <Entity> | None:
        doc = await self._collection.find_one({"_id": ObjectId(entity_id)})
        return self._to_domain(doc) if doc else None

    async def get_by_email(self, email: str) -> <Entity> | None:
        doc = await self._collection.find_one({"email": email})
        return self._to_domain(doc) if doc else None

    async def save(self, entity: <Entity>) -> None:
        document = self._to_document(entity)
        await self._collection.update_one(
            {"_id": document["_id"]},
            {
                "$set": {
                    k: v
                    for k, v in document.items()
                    if k not in {"_id", "created_at"}
                },
                "$setOnInsert": {"created_at": entity.created_at},
            },
            upsert=True,
        )

    async def delete(self, entity_id: str) -> None:
        await self._collection.delete_one({"_id": ObjectId(entity_id)})

    @staticmethod
    def _to_domain(doc: dict) -> <Entity>:
        return <Entity>(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc["name"],
            created_at=doc["created_at"],
        )

    @staticmethod
    def _to_document(entity: <Entity>) -> dict:
        return {
            "_id": ObjectId(entity.id) if entity.id else ObjectId(),
            "email": entity.email,
            "name": entity.name,
            "created_at": entity.created_at,
        }
