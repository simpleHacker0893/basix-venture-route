"""Use case template.

Reglas:
- Recibe ports/protocols por constructor; nunca instancia infrastructure directamente.
- Lanza excepciones de domain (de exceptions.py). NUNCA HTTPException.
- Si hay reglas de autorización de negocio, recibe AuthenticatedPrincipal.
"""

from dataclasses import dataclass

from app.modules.<feature>.application.dto import Create<Entity>Command, <Entity>Result
from app.modules.<feature>.domain.entities import <Entity>
from app.modules.<feature>.domain.exceptions import <Entity>AlreadyExists
from app.modules.<feature>.domain.ports import <Entity>Repository
from app.modules.auth.application.principal import AuthenticatedPrincipal
from app.core.exceptions import PermissionDenied


@dataclass
class Create<Entity>UseCase:
    repo: <Entity>Repository

    async def execute(
        self,
        command: Create<Entity>Command,
        principal: AuthenticatedPrincipal | None = None,
    ) -> <Entity>Result:
        if principal is not None and "<entity>:create" not in principal.scopes:
            raise PermissionDenied("Missing scope: <entity>:create")

        existing = await self.repo.get_by_email(command.email)
        if existing is not None:
            raise <Entity>AlreadyExists(command.email)

        entity = <Entity>(
            id="",  # asignado por el repositorio en save (ObjectId, autoincrement, etc.)
            email=command.email,
            name=command.name,
        )
        await self.repo.save(entity)

        return <Entity>Result.from_entity(entity)
