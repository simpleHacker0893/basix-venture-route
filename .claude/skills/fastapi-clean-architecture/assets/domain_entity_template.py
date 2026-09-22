"""Domain entity template.

Reglas:
- Python puro. NO importes fastapi, sqlalchemy, sqlmodel, pymongo, pydantic.BaseModel.
- Validación de invariantes en __post_init__.
- frozen=True para inmutabilidad; cambios devuelven nueva instancia.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.modules.<feature>.domain.exceptions import Invalid<Entity>


@dataclass(frozen=True)
class <Entity>:
    id: str
    email: str
    name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not self.email or "@" not in self.email:
            raise Invalid<Entity>(f"Invalid email: {self.email!r}")
        if not self.name.strip():
            raise Invalid<Entity>("Name cannot be empty")

    def rename(self, new_name: str) -> "<Entity>":
        if not new_name.strip():
            raise Invalid<Entity>("Name cannot be empty")
        # frozen → devolver nueva instancia
        return <Entity>(
            id=self.id,
            email=self.email,
            name=new_name,
            created_at=self.created_at,
        )
