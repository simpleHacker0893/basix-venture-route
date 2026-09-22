# Celery 5.4: tasks limpias, resilientes y separadas de la lógica de negocio

Celery debe funcionar como **capa de ejecución asíncrona / infraestructura**, no como el lugar donde vive la lógica de negocio. En Clean Architecture, una task es un adaptador de entrada — equivalente a un router HTTP — que recibe un mensaje, valida lo mínimo, invoca un caso de uso y aplica reglas propias de Celery (retries, acks, time limits, routing).

Fuente principal: [Celery 5.4 - Tasks](https://docs.celeryq.dev/en/v5.4.0/userguide/tasks.html)

## Regla de capa

```text
Celery task   = delivery/infrastructure adapter
Use case      = workflow de aplicación
Domain        = reglas de negocio
Repositories  = detalles de infraestructura
```

La task no contiene "si el usuario está en tal estado, entonces…" — esa regla vive en el use case o domain service. La task orquesta ejecución asíncrona:

```python
# app/modules/users/infrastructure/celery_tasks.py
from app.workers.celery_app import celery_app
from app.modules.users.application.use_cases import SendWelcomeEmailUseCase
from app.modules.users.infrastructure.repositories import MongoUserRepository
from app.modules.notifications.infrastructure.email_client import EmailClient


@celery_app.task(
    name="users.send_welcome_email",
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_kwargs={"max_retries": 5},
    retry_backoff=True,
    retry_jitter=True,
    acks_late=True,
    soft_time_limit=30,
    time_limit=60,
)
def send_welcome_email_task(self, user_id: str, idempotency_key: str) -> None:
    """Celery adapter: no contiene reglas de negocio."""
    repo = MongoUserRepository.from_worker_context()
    email_client = EmailClient.from_worker_context()
    use_case = SendWelcomeEmailUseCase(repo=repo, email_client=email_client)
    use_case.execute(user_id=user_id, idempotency_key=idempotency_key)
```

## Configuración base recomendada

```python
# app/workers/celery_app.py
from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery("app", broker=settings.celery_broker_url)

if settings.celery_result_backend:
    celery_app.conf.result_backend = settings.celery_result_backend

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=240,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    task_routes={
        "users.*": {"queue": "users"},
        "notifications.*": {"queue": "notifications"},
    },
)
```

## Idempotencia primero

Si activás `acks_late=True`, la task **debe** ser idempotente: ejecutar dos veces el mismo mensaje no debe causar efectos no deseados.

Patrón:

```text
[ ] Cada task recibe un idempotency_key.
[ ] La task consulta si ese idempotency_key ya fue procesado.
[ ] Si ya fue procesado, retorna sin repetir el side effect.
[ ] Si no, ejecuta el use case y marca el resultado.
```

Implementación con Mongo:

```python
async def mark_task_started(db, idempotency_key: str) -> bool:
    result = await db.processed_tasks.update_one(
        {"_id": idempotency_key},
        {"$setOnInsert": {"status": "started", "created_at": utcnow()}},
        upsert=True,
    )
    return result.upserted_id is not None  # True si es la primera vez


class SendWelcomeEmailUseCase:
    async def execute(self, user_id: str, idempotency_key: str) -> None:
        if not await mark_task_started(self.db, idempotency_key):
            return  # ya procesado

        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise UserNotFound(user_id)

        await self.email_client.send_welcome_email(user.email)
```

## Retries solo para errores transitorios

```python
@celery_app.task(
    name="billing.sync_invoice",
    autoretry_for=(ConnectionError, TimeoutError),
    retry_kwargs={"max_retries": 5},
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def sync_invoice_task(invoice_id: str) -> None:
    ...
```

Regla práctica:

```text
Business error      -> no retry (es un bug o un dato inválido permanente)
Validation error    -> no retry
Provider timeout    -> retry
Connection error    -> retry
Rate limit temporal -> retry con backoff
```

**Evitá** `autoretry_for=(Exception,)`: también reintentaría bugs y errores de programación.

## Timeouts manuales + soft/hard time limits

Celery recomienda timeouts explícitos en operaciones de I/O. Los `time_limit` son la red de seguridad final, no el reemplazo del timeout del cliente HTTP/DB.

```python
@celery_app.task(soft_time_limit=30, time_limit=60)
def call_provider_task(provider_id: str) -> None:
    response = http_client.get(
        f"https://provider.example.com/{provider_id}",
        timeout=(5.0, 20.0),  # connect, read
    )
```

Regla:

```text
Timeout del cliente externo  <  soft_time_limit  <  time_limit
```

## No pasar objetos complejos

Pasá **IDs** y payloads pequeños JSON-serializables. La task reconsulta el estado actual desde la base de datos.

Recomendado:

```python
send_welcome_email_task.delay(user_id=str(user.id), idempotency_key=key)
```

Evitar:

```python
send_welcome_email_task.delay(user)        # objeto complejo
send_welcome_email_task.delay(request)     # objeto HTTP
send_welcome_email_task.delay(document)    # documento Mongo completo
send_welcome_email_task.delay(orm_model)   # SQLAlchemy session-bound
```

## Serialización segura

```python
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)
```

Evitá `pickle` para mensajes no confiables. Para mayor seguridad, Celery 5.4 documenta el serializer `auth` con firma de mensajes.

Fuente: [Celery 5.4 - Security](https://docs.celeryq.dev/en/v5.4.0/userguide/security.html)

## Separar queues por tipo de trabajo

```python
celery_app.conf.task_routes = {
    "emails.*": {"queue": "emails"},
    "reports.*": {"queue": "reports"},
    "billing.*": {"queue": "billing"},
}
```

Workers separados:

```bash
celery -A app.workers.celery_app worker -Q emails --hostname=emails@%h
celery -A app.workers.celery_app worker -Q reports --hostname=reports@%h
```

## `apply_async` vs `delay`

`delay()` está bien para casos simples. Usá `apply_async()` cuando necesites control:

```python
sync_clerk_user_task.apply_async(
    kwargs={
        "clerk_user_id": user_id,
        "idempotency_key": f"clerk-user-sync:{event_id}",
    },
    queue="users",
    task_id=f"users.sync_clerk_user:{event_id}",
    expires=3600,
)
```

## Result backend solo cuando haga falta

Para fire-and-forget:

```python
@celery_app.task(name="analytics.track_event", ignore_result=True)
def track_event_task(event_id: str) -> None:
    ...
```

## Celery + código async

Celery 5.4 ejecuta tasks como callables normales. Si tu use case es async, definí una frontera explícita:

```python
import asyncio


@celery_app.task(name="users.recompute_score", bind=True)
def recompute_user_score_task(self, user_id: str) -> None:
    asyncio.run(_recompute_user_score(user_id))


async def _recompute_user_score(user_id: str) -> None:
    repo = await get_async_mongo_user_repository_for_worker()
    use_case = RecomputeUserScoreUseCase(repo=repo)
    await use_case.execute(user_id=user_id)
```

Reglas críticas:

- **No compartir** `AsyncMongoClient` entre procesos/threads/event loops.
- **No importar** la FastAPI app dentro del worker. El worker tiene su propio composition root.
- Para alto throughput, evaluar mantener un runner async por proceso con cliente ligado a un solo event loop.

## Checklist Celery 5.4

```text
[ ] Las tasks son adaptadores delgados, no contienen reglas de negocio.
[ ] Cada task llama a un use case de Application.
[ ] Los payloads son JSON y pequeños (IDs, no objetos).
[ ] Los nombres de tasks son explícitos y estables.
[ ] Las tasks críticas tienen idempotency_key.
[ ] acks_late=True solo en tasks idempotentes.
[ ] autoretry_for cubre solo errores transitorios conocidos.
[ ] retry_backoff y retry_jitter habilitados para proveedores externos.
[ ] Timeouts internos + soft/hard time_limits definidos.
[ ] Queues separadas para trabajos lentos/rápidos/críticos.
[ ] apply_async() cuando se necesitan opciones de ejecución.
[ ] ignore_result=True para fire-and-forget.
[ ] Celery beat corre como instancia única por schedule.
[ ] No se pasan modelos ORM/ODM, Request, Response ni entidades completas.
[ ] El worker NO importa FastAPI app ni usa app.state.
```

## Fuentes

- [Celery 5.4 - Tasks](https://docs.celeryq.dev/en/v5.4.0/userguide/tasks.html)
- [Celery 5.4 - Calling Tasks](https://docs.celeryq.dev/en/v5.4.0/userguide/calling.html)
- [Celery 5.4 - Routing Tasks](https://docs.celeryq.dev/en/v5.4.0/userguide/routing.html)
- [Celery 5.4 - Configuration](https://docs.celeryq.dev/en/v5.4.0/userguide/configuration.html)
- [Celery 5.4 - Security](https://docs.celeryq.dev/en/v5.4.0/userguide/security.html)
