from collections.abc import Callable
from datetime import datetime

from fastapi import Request

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief
from app.routing.route_service import RouteService

Clock = Callable[[], datetime]


def get_clock(request: Request) -> Clock:
    """The app's notion of now (aware UTC). Real time in production; tests inject a fixed
    instant through create_app so "upcoming" never depends on the wall clock."""
    clock: Clock = request.app.state.clock
    return clock


def get_engine(request: Request) -> MettaRouteEngine:
    engine: MettaRouteEngine = request.app.state.engine
    return engine


def get_seed_briefs(request: Request) -> dict[str, VentureBrief]:
    briefs: dict[str, VentureBrief] = request.app.state.seed_briefs
    return briefs


def get_route_service(request: Request) -> RouteService:
    service: RouteService = request.app.state.route_service
    return service
