# Manejo de errores: excepciones de dominio → HTTP

Regla:

```text
Domain y Application lanzan excepciones específicas de dominio o aplicación.
API layer las mapea a respuestas HTTP vía @app.exception_handler.
```

Los use cases **nunca** lanzan `HTTPException`. Eso haría que dependan de FastAPI.

## Jerarquía de excepciones

```python
# app/modules/users/domain/exceptions.py


class UserDomainError(Exception):
    """Base para excepciones del módulo users."""


class UserNotFound(UserDomainError):
    def __init__(self, user_id: str):
        super().__init__(f"User {user_id} not found")
        self.user_id = user_id


class UserAlreadyExists(UserDomainError):
    def __init__(self, email: str):
        super().__init__(f"User with email {email} already exists")
        self.email = email


class InvalidEmail(UserDomainError):
    pass
```

Excepciones de aplicación más generales:

```python
# app/core/exceptions.py


class ApplicationError(Exception):
    """Base para errores de la capa de aplicación."""


class PermissionDenied(ApplicationError):
    pass


class ValidationError(ApplicationError):
    pass
```

## Handlers en la capa API

```python
# app/api/exception_handlers.py
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.users.domain.exceptions import (
    UserNotFound,
    UserAlreadyExists,
    InvalidEmail,
)
from app.core.exceptions import PermissionDenied, ValidationError


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(UserNotFound)
    async def user_not_found_handler(request: Request, exc: UserNotFound):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "User not found", "user_id": exc.user_id},
        )

    @app.exception_handler(UserAlreadyExists)
    async def user_already_exists_handler(request: Request, exc: UserAlreadyExists):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "User already exists", "email": exc.email},
        )

    @app.exception_handler(InvalidEmail)
    async def invalid_email_handler(request: Request, exc: InvalidEmail):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": str(exc)},
        )

    @app.exception_handler(PermissionDenied)
    async def permission_denied_handler(request: Request, exc: PermissionDenied):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": str(exc) or "Permission denied"},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": str(exc)},
        )
```

Registralos en `main.py`:

```python
from app.api.exception_handlers import register_exception_handlers

app = FastAPI(lifespan=lifespan)
register_exception_handlers(app)
```

## Antipatrón: HTTPException dentro del use case

```python
# MAL
class CreateUserUseCase:
    async def execute(self, command: CreateUserCommand):
        existing = await self.repo.get_by_email(command.email)
        if existing:
            raise HTTPException(status_code=409, detail="User already exists")  # NO
```

Problemas:

- El use case ahora depende de FastAPI.
- No se puede llamar desde Celery, management commands ni scripts sin importar FastAPI.
- Los tests del use case necesitan FastAPI instalado.

Correcto:

```python
# BIEN
class CreateUserUseCase:
    async def execute(self, command: CreateUserCommand):
        existing = await self.repo.get_by_email(command.email)
        if existing:
            raise UserAlreadyExists(command.email)
```

El handler `@app.exception_handler(UserAlreadyExists)` se encarga del 409.

## Códigos HTTP típicos

| Excepción de dominio | HTTP status |
|---------------------|-------------|
| `XNotFound` | 404 |
| `XAlreadyExists` (conflicto de unicidad) | 409 |
| `InvalidX` (validación de invariante) | 422 |
| `PermissionDenied` | 403 |
| Auth faltante/inválida | 401 (en la dependency) |
| Rate limit | 429 |
| Estado conflictivo del recurso | 409 |
| Precondición fallida | 412 |

## Estructura de respuesta consistente

Usá un shape estable:

```json
{
  "detail": "User not found",
  "user_id": "abc123"
}
```

O un envelope más rico si tu equipo lo prefiere:

```json
{
  "error": {
    "code": "user_not_found",
    "message": "User not found",
    "details": {"user_id": "abc123"}
  }
}
```

Lo importante es **consistencia**: todos los errores siguen la misma forma. Los clientes pueden parsearlos genéricamente.

## Validación Pydantic (422)

Pydantic ya devuelve 422 con detalle estructurado cuando un request no valida. No hace falta capturarlo: FastAPI lo maneja.

## Logging de errores

```python
import logging

logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
```

No exponer stacktraces al cliente en producción. Loguear con `logger.exception` para que se registre el traceback.

## Checklist error handling

```text
[ ] Use cases NUNCA lanzan HTTPException.
[ ] Excepciones de dominio en domain/exceptions.py.
[ ] Excepciones de aplicación en core/exceptions.py o por módulo.
[ ] register_exception_handlers(app) llamado en main.py.
[ ] Cada excepción de dominio mapeada a un status code claro.
[ ] Estructura de respuesta de error consistente.
[ ] Unhandled exceptions logueadas con logger.exception y devueltas como 500 genérico.
[ ] Tests del use case verifican que se levanta la excepción de dominio (no el 409 HTTP).
[ ] Tests del router verifican el status code + body (no la excepción interna).
```
