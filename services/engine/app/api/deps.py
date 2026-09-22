from fastapi import Request

from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import VentureBrief


def get_engine(request: Request) -> MettaRouteEngine:
    engine: MettaRouteEngine = request.app.state.engine
    return engine


def get_seed_briefs(request: Request) -> dict[str, VentureBrief]:
    briefs: dict[str, VentureBrief] = request.app.state.seed_briefs
    return briefs
