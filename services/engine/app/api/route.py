"""POST /api/route (structured-form path, no LLM) and GET /api/scenarios (Sprint 001, #15)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_engine, get_route_service, get_seed_briefs
from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.models.ecosystem import Ecosystem
from app.models.route import VentureRoute
from app.routing.ecosystem import ecosystem_view
from app.routing.route_service import RouteService

router = APIRouter(prefix="/api", tags=["routing"])


@router.post("/route", response_model=VentureRoute, response_model_by_alias=True)
def route(
    brief: VentureBrief,
    service: Annotated[RouteService, Depends(get_route_service)],
) -> VentureRoute:
    """Full brief in, route out. Shares the route service with POST /api/conversation."""
    return service.route(brief)


@router.get("/scenarios", response_model=list[VentureBrief], response_model_by_alias=True)
def scenarios(
    briefs: Annotated[dict[str, VentureBrief], Depends(get_seed_briefs)],
) -> list[VentureBrief]:
    """The five seed briefs, in seed order, so the UI can preload them."""
    return list(briefs.values())


@router.get("/ecosystem", response_model=Ecosystem, response_model_by_alias=True)
def ecosystem(engine: Annotated[MettaRouteEngine, Depends(get_engine)]) -> Ecosystem:
    """The seed partners, universities with cohorts and licensable assets (#79). Public: the
    footer's Partners page reads it; every entity is fictional demo data."""
    return ecosystem_view(engine)
