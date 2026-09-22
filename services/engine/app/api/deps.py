from fastapi import Request

from app.engine.metta_engine import MettaRouteEngine


def get_engine(request: Request) -> MettaRouteEngine:
    engine: MettaRouteEngine = request.app.state.engine
    return engine
