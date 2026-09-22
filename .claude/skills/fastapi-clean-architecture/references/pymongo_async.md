# MongoDB async con PyMongo

Para una app FastAPI moderna con MongoDB, usá **PyMongo Async API** mediante `AsyncMongoClient`. MongoDB documenta PyMongo como la forma recomendada desde Python; la documentación actual incluye APIs síncronas y asíncronas en el mismo paquete.

Fuente: [MongoDB PyMongo Driver](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/)

## ¿Por qué no Motor?

Motor está deprecado en favor de la API async de PyMongo. MongoDB indica que Motor fue deprecado el 14 de mayo de 2025 y su fin de vida es el 14 de mayo de 2026. PyMongo Async unifica PyMongo y Motor.

Regla:

```text
Proyectos nuevos: usar pymongo.AsyncMongoClient.
No iniciar proyectos nuevos con Motor.
Si ya existe Motor: planear migración.
```

Fuente: [MongoDB - Migrate to PyMongo Async](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/)

## Cliente Mongo en lifespan, no por request

Creá **un solo** `AsyncMongoClient` durante el lifespan de FastAPI, verificá conexión con `ping`, cerralo en shutdown.

```python
# app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import AsyncMongoClient
from pymongo.errors import ConnectionFailure

from app.core.config import get_settings


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

    try:
        yield
    finally:
        await client.close()


app = FastAPI(lifespan=lifespan)
```

Dependencia FastAPI:

```python
# app/api/deps.py
from fastapi import Request
from pymongo.asynchronous.database import AsyncDatabase


def get_db(request: Request) -> AsyncDatabase:
    return request.app.state.db
```

## Repositorios async detrás de Protocol

Application depende del Protocol; Infrastructure implementa.

```python
# app/modules/users/domain/ports.py
from typing import Protocol
from app.modules.users.domain.entities import User


class UserRepository(Protocol):
    async def get_by_id(self, user_id: str) -> User | None: ...
    async def get_by_clerk_id(self, clerk_user_id: str) -> User | None: ...
    async def save(self, user: User) -> None: ...
```

```python
# app/modules/users/infrastructure/repositories.py
from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.modules.users.domain.entities import User


class MongoUserRepository:
    def __init__(self, db: AsyncDatabase):
        self._collection = db["users"]

    async def get_by_id(self, user_id: str) -> User | None:
        doc = await self._collection.find_one({"_id": ObjectId(user_id)})
        return self._to_domain(doc) if doc else None

    async def get_by_clerk_id(self, clerk_user_id: str) -> User | None:
        doc = await self._collection.find_one({"clerk_user_id": clerk_user_id})
        return self._to_domain(doc) if doc else None

    async def save(self, user: User) -> None:
        document = self._to_document(user)
        await self._collection.update_one(
            {"_id": document["_id"]},
            {"$set": document, "$setOnInsert": {"created_at": user.created_at}},
            upsert=True,
        )

    def _to_domain(self, doc: dict) -> User:
        return User(
            id=str(doc["_id"]),
            clerk_user_id=doc["clerk_user_id"],
            email=doc["email"],
            name=doc.get("name", ""),
            created_at=doc["created_at"],
        )

    def _to_document(self, user: User) -> dict:
        return {
            "_id": ObjectId(user.id) if user.id else ObjectId(),
            "clerk_user_id": user.clerk_user_id,
            "email": user.email,
            "name": user.name,
        }
```

Regla fuerte:

```text
ObjectId, nombres de colecciones, mappers doc <-> entity y operaciones $set/$setOnInsert
viven SOLO en infrastructure. El dominio no depende de bson ni de pymongo.
```

## Índices declarados explícitamente

Los índices son garantías de infraestructura para invariantes de negocio. Crealos en startup controlado, no por request.

```python
# app/modules/users/infrastructure/mongo_indexes.py
from pymongo import ASCENDING
from pymongo.asynchronous.database import AsyncDatabase


async def ensure_user_indexes(db: AsyncDatabase) -> None:
    users = db["users"]
    await users.create_index([("clerk_user_id", ASCENDING)], unique=True)
    await users.create_index([("email", ASCENDING)], unique=True)
    await users.create_index(
        [("organization_id", ASCENDING), ("created_at", ASCENDING)]
    )
```

Llamalo desde lifespan (después del `ping`):

```python
from app.modules.users.infrastructure.mongo_indexes import ensure_user_indexes

# dentro del lifespan, después del ping y antes del yield:
await ensure_user_indexes(app.state.db)
```

Para tasks idempotentes:

```python
await db.processed_tasks.create_index(
    "created_at",
    expireAfterSeconds=60 * 60 * 24 * 30,  # TTL 30 días
)
```

## Transacciones solo cuando se necesiten

```python
async with await mongo_client.start_session() as session:
    async with session.start_transaction():
        await users.update_one({"_id": uid}, {...}, session=session)
        await audit_logs.insert_one({...}, session=session)
```

Reglas:

```text
[ ] Usar transacciones SOLO para consistencia multi-documento real.
[ ] Evitar llamadas HTTP externas dentro de una transacción.
[ ] Mantener transacciones cortas.
[ ] Pasar session explícitamente a repositorios cuando aplique.
[ ] Reutilizar el MongoClient para múltiples sesiones (no crear cliente nuevo).
```

## Modelado y validación: cuatro modelos distintos

```text
API schema         -> Pydantic request/response (frontera HTTP)
Application DTO    -> commands/queries del use case
Domain entity      -> reglas y estado del negocio
Mongo document     -> dict de persistencia (con ObjectId)
```

Evitá usar un documento Mongo crudo como entidad de dominio. Usá mappers explícitos en el repositorio.

## Cuándo el patrón completo paga

- Modulo con invariantes de negocio (no solo CRUD).
- Tests que necesitan ejecutarse sin levantar Mongo real (usar fake del Protocol).
- Múltiples disparadores (router + Celery + management command) que comparten lógica.

Para CRUD plano sin reglas: un router que use directamente `db["collection"]` puede ser suficiente. No forzar capas vacías.

## Checklist PyMongo async

```text
[ ] Usar pymongo.AsyncMongoClient en FastAPI.
[ ] No usar Motor para proyectos nuevos.
[ ] Cliente creado en lifespan, cerrado con await client.close().
[ ] No crear un cliente por request HTTP.
[ ] No compartir AsyncMongoClient entre event loops/threads/procesos.
[ ] Timeouts del driver: serverSelectionTimeoutMS, connectTimeoutMS, socketTimeoutMS.
[ ] Índices únicos respaldan invariantes (email, clerk_user_id, idempotency_key).
[ ] ensure_<feature>_indexes(db) corre en startup.
[ ] Domain no importa bson ni pymongo.
[ ] Mappers _to_domain / _to_document explícitos en el repositorio.
[ ] Transacciones solo para multi-doc real.
[ ] Celery NO comparte cliente con FastAPI: worker tiene su propio composition root.
```

## Fuentes

- [MongoDB PyMongo Driver](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/)
- [PyMongo - Connect to MongoDB](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/)
- [PyMongo - Indexes](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/indexes/)
- [PyMongo - Transactions](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/crud/transactions/)
- [PyMongo - Migrate to Async](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/)
- [PyMongo AsyncMongoClient API](https://pymongo.readthedocs.io/en/stable/api/pymongo/asynchronous/mongo_client.html)
