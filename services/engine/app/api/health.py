from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_engine
from app.config import Settings, get_settings
from app.engine.metta_engine import MettaRouteEngine

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    facts_loaded: int
    rules_loaded: int
    hyperon_version: str
    demo_today: str


@router.get("/health", response_model=HealthResponse)
def health(
    engine: Annotated[MettaRouteEngine, Depends(get_engine)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> HealthResponse:
    return HealthResponse(
        status="ok",
        facts_loaded=engine.facts_loaded,
        rules_loaded=engine.rules_loaded,
        hyperon_version=engine.hyperon_version,
        demo_today=settings.demo_today.isoformat(),
    )
