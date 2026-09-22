"""Pydantic schemas template (API frontier).

Reglas:
- Schemas viven en app/modules/<feature>/schemas.py.
- Separar Create / Update / Response: campos distintos, validación distinta.
- Conversión schema -> command via to_command(); response viene del Result del use case.
- NO usar estos schemas como entidades de dominio.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.modules.<feature>.application.dto import Create<Entity>Command


class <Entity>CreateSchema(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)

    def to_command(self) -> Create<Entity>Command:
        return Create<Entity>Command(email=self.email, name=self.name)


class <Entity>UpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class <Entity>Response(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
