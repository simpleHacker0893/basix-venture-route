"""FastAPI router template.

Reglas:
- El router es DELGADO. No tiene lógica de negocio.
- Cada endpoint: inyecta use case via Depends -> convierte schema a command -> llama use_case.execute -> devuelve Response.
- response_model en cada ruta (para documentación + filtrado de output).
- Auth: principal: AuthenticatedPrincipal = Depends(get_user_principal).
"""

from fastapi import APIRouter, Depends, status

from app.api.deps import (
    get_create_<entity>_use_case,
    get_get_<entity>_use_case,
)
from app.modules.<feature>.application.use_cases import (
    Create<Entity>UseCase,
    Get<Entity>UseCase,
)
from app.modules.<feature>.schemas import <Entity>CreateSchema, <Entity>Response
from app.modules.auth.application.principal import AuthenticatedPrincipal
from app.api.auth.clerk_auth import get_user_principal


router = APIRouter(prefix="/<entity_plural>", tags=["<entity_plural>"])


@router.post(
    "",
    response_model=<Entity>Response,
    status_code=status.HTTP_201_CREATED,
    summary="Create <entity>",
)
async def create_<entity>(
    payload: <Entity>CreateSchema,
    use_case: Create<Entity>UseCase = Depends(get_create_<entity>_use_case),
    principal: AuthenticatedPrincipal = Depends(get_user_principal),
) -> <Entity>Response:
    result = await use_case.execute(payload.to_command(), principal=principal)
    return <Entity>Response.model_validate(result)


@router.get(
    "/{entity_id}",
    response_model=<Entity>Response,
    summary="Get <entity> by id",
)
async def get_<entity>(
    entity_id: str,
    use_case: Get<Entity>UseCase = Depends(get_get_<entity>_use_case),
    principal: AuthenticatedPrincipal = Depends(get_user_principal),
) -> <Entity>Response:
    result = await use_case.execute(entity_id=entity_id, principal=principal)
    return <Entity>Response.model_validate(result)
