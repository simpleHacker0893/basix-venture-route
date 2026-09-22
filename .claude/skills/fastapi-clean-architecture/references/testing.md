# Testing FastAPI clean architecture

Tres niveles, cada uno con su herramienta y su BD.

```text
Unit tests        -> entidades de dominio + casos de uso. SIN FastAPI TestClient. Fake del Protocol.
Integration tests -> rutas de API con TestClient + dependency_overrides + test DB.
Contract tests    -> adaptadores HTTP/colas/email contra el servicio real (o WireMock/Mountebank).
```

Regla: **preferí testear casos de uso directamente**. No hagas que todos los tests pasen por HTTP.

Fuentes: [FastAPI - Testing Dependencies](https://fastapi.tiangolo.com/advanced/testing-dependencies/), [SQLModel - FastAPI Tests](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/)

## Unit test de use case con fake del Protocol

El fake **implementa el Protocol completo**. No mockear con `MagicMock` suelto.

```python
# app/modules/users/application/tests/test_create_user.py
import pytest

from app.modules.users.application.dto import CreateUserCommand
from app.modules.users.application.use_cases import CreateUserUseCase
from app.modules.users.domain.entities import User
from app.modules.users.domain.exceptions import UserAlreadyExists


class FakeUserRepository:
    def __init__(self):
        self._by_email: dict[str, User] = {}

    async def get_by_email(self, email: str) -> User | None:
        return self._by_email.get(email)

    async def get_by_id(self, user_id: str) -> User | None:
        for user in self._by_email.values():
            if user.id == user_id:
                return user
        return None

    async def save(self, user: User) -> None:
        self._by_email[user.email] = user


@pytest.mark.asyncio
async def test_create_user_happy_path():
    # Arrange
    repo = FakeUserRepository()
    use_case = CreateUserUseCase(repo=repo)
    command = CreateUserCommand(email="ada@example.com", name="Ada Lovelace")

    # Act
    result = await use_case.execute(command)

    # Assert
    assert result.email == "ada@example.com"
    stored = await repo.get_by_email("ada@example.com")
    assert stored is not None
    assert stored.name == "Ada Lovelace"


@pytest.mark.asyncio
async def test_create_user_duplicate_email_raises():
    # Arrange
    repo = FakeUserRepository()
    use_case = CreateUserUseCase(repo=repo)
    await use_case.execute(CreateUserCommand(email="ada@example.com", name="Ada"))

    # Act & Assert
    with pytest.raises(UserAlreadyExists):
        await use_case.execute(CreateUserCommand(email="ada@example.com", name="Ada 2"))
```

Reglas:

- El fake **hereda** del Protocol (o lo implementa estructuralmente). No es un mock suelto.
- Tests siguen AAA: Arrange — Act — Assert.
- No tocan red, no levantan FastAPI, no necesitan Mongo/SQL.

## Integration test con `dependency_overrides`

FastAPI permite reemplazar dependencias en tests sin tocar el código de producción.

```python
# tests/integration/test_users_router.py
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_user_repository
from app.modules.users.application.tests.test_create_user import FakeUserRepository


@pytest.fixture
def fake_repo():
    return FakeUserRepository()


@pytest.fixture
def client(fake_repo):
    app.dependency_overrides[get_user_repository] = lambda: fake_repo
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_post_users_creates_and_returns_201(client, fake_repo):
    response = client.post("/api/v1/users", json={"email": "ada@example.com", "name": "Ada"})

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@example.com"


def test_post_users_duplicate_returns_409(client):
    client.post("/api/v1/users", json={"email": "ada@example.com", "name": "Ada"})
    response = client.post("/api/v1/users", json={"email": "ada@example.com", "name": "Ada 2"})

    assert response.status_code == 409
    assert response.json()["detail"] == "User already exists"
```

## Tests con test database

Para tests que sí necesitan persistencia real (chequear índices únicos, queries complejas, transacciones):

### SQLModel / SQLAlchemy

```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api.deps import get_db


@pytest.fixture
async def test_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    # crear schema
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def test_session(test_engine):
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def client(test_session):
    app.dependency_overrides[get_db] = lambda: test_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

### MongoDB async

```python
# tests/conftest.py
import pytest
from pymongo import AsyncMongoClient


@pytest.fixture
async def test_db():
    client = AsyncMongoClient("mongodb://localhost:27017", uuidRepresentation="standard")
    db = client["test_fastapi_clean"]
    yield db
    # cleanup
    await client.drop_database("test_fastapi_clean")
    await client.close()


@pytest.fixture
def client(test_db):
    from app.api.deps import get_db
    app.dependency_overrides[get_db] = lambda: test_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Para Mongo en CI, considerá:

- **testcontainers-python**: levanta Mongo en Docker, lo mata al final del run.
- **mongomock-motor / pymongo-inmemory**: in-memory, más rápido pero no cubre features avanzadas.

## Contract tests para adaptadores externos

Los adaptadores HTTP/Celery/email tienen tests propios contra:

- El servicio real (en entorno de staging del proveedor).
- WireMock / Mountebank / pytest-httpserver (replay).
- Un mock servidor del proveedor si lo provee.

El use case ya está cubierto con el fake del Protocol; el contract test verifica que la implementación concreta cumple ese Protocol con el servicio real.

## Reglas de testing

```text
[ ] Tests de use cases NO tocan FastAPI ni HTTP.
[ ] Fakes implementan el Protocol completo, no son MagicMock sueltos.
[ ] Tests siguen AAA (Arrange-Act-Assert) con líneas en blanco entre fases.
[ ] dependency_overrides en lugar de monkeypatching de internals.
[ ] Test DB separada de la de producción (NUNCA correr tests contra prod).
[ ] Tests de routers chequean status code + estructura de respuesta, no la lógica.
[ ] Tests de adaptadores externos son contract tests, no se mezclan con tests de use case.
[ ] Cleanup de overrides al final de cada test (app.dependency_overrides.clear()).
```

## Fuentes

- [FastAPI - Testing Dependencies](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [SQLModel - FastAPI Tests](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/)
- [pytest - Fixtures](https://docs.pytest.org/en/stable/explanation/fixtures.html)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
