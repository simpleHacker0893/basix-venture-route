# Workflow multi-subagent — fastapi-clean-architecture

Este documento amplía `SKILL.md` con criterios de decisión, **contrato compartido** entre subagentes, resolución de inconsistencias y un **ejemplo orquestado** end-to-end basado en un módulo `users` con MongoDB async y auth Clerk.

## Cuándo activar multi-subagent vs single-agent

| Situación | Modo recomendado |
|-----------|------------------|
| Usuario pide "el módulo completo", "todas las capas", entities + use cases + repositorio + router | **Multi-subagent** |
| Feature nueva con persistencia + API + posiblemente tarea Celery desde cero | **Multi-subagent** |
| Agregar un endpoint a un router existente o un método a un repositorio | **Single-agent** |
| Explicar el patrón, revisar código existente, refactor pequeño | **Single-agent** |
| Dudas sobre dónde poner una regla, si hace falta repositorio o si conviene dejar SQLModel directo | **Single-agent** (leer referencias) |

Si el alcance es ambiguo, el orquestador pregunta antes de lanzar cuatro subagentes.

## Contrato compartido (antes de delegar)

Fijá por escrito (en el chat o en un bloque que copiás a cada prompt) estos puntos para que las cuatro salidas encajen:

1. **Paquete Python base**: `app.modules.<feature>` (ej. `app.modules.users`).
2. **Persistencia elegida**: SQL (SQLAlchemy/SQLModel) **o** Mongo (PyMongo async). Una sola por módulo. Esto define los nombres de archivos.
3. **Auth mode aceptado por los routers**: `clerk_jwt` | `api_key` | mixto. Define qué dependencia se inyecta.
4. **Nombres acordados**:
   - Entidad: `User` → `domain/entities.py`
   - Comando(s): `CreateUserCommand`, `UpdateUserCommand` → `application/dto.py`
   - Excepciones de dominio: `UserNotFound`, `UserAlreadyExists` → `domain/exceptions.py`
   - Port: `UserRepository` (Protocol) → `domain/ports.py`
   - Use cases: `CreateUserUseCase`, `GetUserUseCase` → `application/use_cases.py`
   - Implementación: `SqlAlchemyUserRepository` o `MongoUserRepository` → `infrastructure/repositories.py`
   - Tasks Celery (si aplican): `sync_user_task` → `infrastructure/celery_tasks.py`
   - Schemas API: `UserCreateSchema`, `UserResponse`, `UserUpdateSchema` → `schemas.py`
   - Router: `users_router` → `app/api/v1/users.py`
   - Providers: `get_user_repository`, `get_create_user_use_case` → `app/api/deps.py`
5. **Resultado**: si hay dataclass de resultado para casos de uso complejos (ej. `SyncResult(total, success, failed)`), nombre y campos acordados.
6. **Patrón transaccional**: declarar si el caso de uso necesita transacción Mongo multi-doc o `async with session.begin()` de SQLAlchemy.

Sin este contrato es frecuente que un subagente invente nombres distintos y la síntesis falle.

## Inconsistencias frecuentes y cómo resolverlas

| Síntoma | Causa típica | Acción |
|---------|--------------|--------|
| `ImportError` en `deps.py` | Clase renombrada distinto entre subagentes | Re-delegar al subagente con la lista de nombres correctos del contrato |
| El caso de uso captura una excepción que no existe | A y B desalineados (excepciones en domain vs uso en application) | Pedir a A que alinee `exceptions.py` o a B que use los nombres correctos |
| El repositorio no tiene el método que llama el caso de uso | A/C y B desalineados | Re-delegar C con la lista exacta de llamadas que hace B |
| Router pasa `Request` o `payload` raw al caso de uso | D mezcló capas | Corregir D: el router convierte `XSchema → XCommand` y pasa el `Command` |
| Tests usan mock suelto en lugar de fake del Protocol | B/C ignoraron la regla | Re-delegar: el fake debe implementar `UserRepository` (Protocol) |
| `HTTPException` lanzada desde un use case | B mezcló capa de API en application | Corregir B: lanzar excepción de dominio; el handler vive en `api/exception_handlers.py` |

El orquestador **no** debe reescribir todo a ciegas: preferí un segundo pase quirúrgico al subagente que desvió del contrato.

## Sub-Agent prompts (templates para copiar)

Antes de cada bloque, el orquestador pega el **contrato compartido** completo.

### Subagente A — Domain

```
Generá la capa Domain del módulo `<feature>` en `app/modules/<feature>/domain/`:

- entities.py: dataclass(frozen=True) `<Entidad>` con validación en __post_init__.
- value_objects.py (si aplica): VOs con identidad por valor.
- exceptions.py: jerarquía de excepciones de dominio (ver contrato).
- ports.py: Protocol `<Entidad>Repository` con métodos async que el use case necesita.

Reglas:
- NO importes fastapi, sqlalchemy, sqlmodel, pymongo, bson, pydantic.BaseModel.
- NO uses HTTPException ni status codes.
- Devolvé el código completo de cada archivo, sin TODOs.
```

### Subagente B — Application

```
Generá la capa Application del módulo `<feature>` en `app/modules/<feature>/application/`:

- dto.py: dataclasses para commands/queries (ver contrato).
- use_cases.py: clases de caso de uso con __init__(repo: <Entidad>Repository, ...) y async def execute(command) -> result.
- tests/test_use_cases.py: tests con un fake que herede del Protocol `<Entidad>Repository`.

Reglas:
- Importá Protocols de domain, NO implementaciones de infrastructure.
- Lanzá excepciones de domain (de exceptions.py), NUNCA HTTPException.
- Los use cases reciben un AuthenticatedPrincipal cuando hay reglas de autorización de negocio.
- El fake en tests implementa el Protocol completo. Usá AAA (Arrange-Act-Assert).
```

### Subagente C — Infrastructure

```
Generá la capa Infrastructure del módulo `<feature>` en `app/modules/<feature>/infrastructure/`:

- repositories.py: `<Engine><Entidad>Repository` que implementa el Protocol de domain (SQLAlchemy o PyMongo async según contrato).
- celery_tasks.py (si aplica): tasks como adaptadores delgados que llaman al use case (ver references/celery_5_4.md).
- mongo_indexes.py (solo si Mongo): función `ensure_<feature>_indexes(db)` para correr en lifespan.

Reglas:
- Mappers explícitos: `_to_domain(doc_o_row) -> Entidad`, `_to_persistence(entidad) -> doc_o_row`.
- ObjectId / Column / Table / serialization de campos viven solo acá; no salen hacia application/domain.
- Los métodos async coinciden 1:1 con la firma del Protocol.
- En Celery: `autoretry_for` SOLO para errores transitorios; idempotency_key para tasks críticas; `asyncio.run(...)` para llamar use cases async.
```

### Subagente D — API

```
Generá la capa API del módulo `<feature>`:

- app/modules/<feature>/schemas.py: `<Entidad>CreateSchema`, `<Entidad>Response`, `<Entidad>UpdateSchema` (Pydantic v2).
- app/api/v1/<feature>.py: APIRouter con endpoints delgados. Cada endpoint inyecta el use case vía Depends, convierte schema → command, llama use_case.execute(...), retorna Response.
- app/api/deps.py: providers `get_<feature>_repository`, `get_<use_case>` con Depends correctos.
- app/api/exception_handlers.py: handlers `@app.exception_handler(<DomainException>)` que mapean a JSONResponse con status code correcto.

Reglas:
- Los endpoints NO contienen lógica de negocio. Solo: validar (Pydantic ya lo hace), inyectar use case, llamar, responder.
- `response_model=<Entidad>Response` en cada endpoint.
- Auth: inyectá `principal: AuthenticatedPrincipal = Depends(get_user_principal)` según el modo del contrato (clerk_jwt / api_key / mixto).
- Los handlers de excepciones devuelven JSON estructurado con detail explícito.
```

## Ejemplo orquestado: módulo `users` con Mongo + Clerk

Contrato:

- **Paquete**: `app.modules.users`
- **Persistencia**: Mongo async
- **Auth**: Clerk JWT (usuarios humanos)
- **Entidad**: `User(id, clerk_user_id, email, name, created_at)`
- **Excepciones**: `UserNotFound`, `UserAlreadyExists`
- **Use cases**: `CreateUserUseCase`, `GetUserByClerkIdUseCase`, `UpdateUserUseCase`
- **Repositorio**: `MongoUserRepository`
- **Tasks**: ninguna en este módulo (auth no necesita Celery)
- **Schemas**: `UserCreateSchema`, `UserResponse`, `UserUpdateSchema`
- **Router**: `users_router` montado en `/api/v1/users`

### Paso 1 — Contrato pegado a los cuatro prompts

El orquestador copia el bloque completo de contrato antes de lanzar A, B, C, D.

### Paso 2 — Paralelo

- **A** genera `domain/entities.py` (User dataclass), `domain/exceptions.py`, `domain/ports.py` (UserRepository Protocol con `get_by_clerk_id`, `save`, etc.).
- **B** genera `application/dto.py`, `application/use_cases.py` con los 3 casos y tests con `FakeUserRepository`.
- **C** genera `infrastructure/repositories.py` (MongoUserRepository con mappers explícitos) y `infrastructure/mongo_indexes.py` (índice único en `clerk_user_id`).
- **D** genera `schemas.py`, `api/v1/users.py`, providers en `api/deps.py`, handlers en `api/exception_handlers.py`.

### Paso 3 — Síntesis

El orquestador verifica:

- `CreateUserUseCase` importa `UserRepository` desde `domain/ports.py` y `UserAlreadyExists` desde `domain/exceptions.py`.
- `MongoUserRepository` cumple el Protocol completo (todas las firmas async coinciden).
- `get_create_user_use_case` en `deps.py` resuelve `MongoUserRepository(db)` desde `app.state.db`.
- El router pasa `principal` al use case cuando hay autorización (`UpdateUserUseCase` chequea `principal.subject == user.clerk_user_id`).
- El handler `UserNotFound → 404` y `UserAlreadyExists → 409` están registrados en `main.py`.

### Paso 4 — Entrega

Mini-mapa de archivos creados:

```
app/modules/users/
├── domain/
│   ├── entities.py
│   ├── exceptions.py
│   └── ports.py
├── application/
│   ├── dto.py
│   ├── use_cases.py
│   └── tests/test_use_cases.py
├── infrastructure/
│   ├── repositories.py
│   └── mongo_indexes.py
└── schemas.py

app/api/
├── deps.py            (providers users-related)
├── exception_handlers.py
└── v1/users.py        (router)
```

## Referencias cruzadas

- `SKILL.md` — secciones **Workflow** y **Workflow multi-subagent**
- `references/pymongo_async.md` — patrones MongoDB async
- `references/clerk_jwt.md` — verificación JWT y `AuthenticatedPrincipal`
- `references/testing.md` — fakes que heredan de Protocol y `dependency_overrides`
- `references/error_handling.md` — mapeo excepciones → HTTP
