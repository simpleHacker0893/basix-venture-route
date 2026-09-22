"""Composition root. The engine is built once in the lifespan and shared via app.state."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.internal import router as internal_router
from app.config import get_settings
from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine
from app.models.brief import load_seed_briefs


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.engine = MettaRouteEngine(settings)
    app.state.seed_briefs = {
        brief.id: brief for brief in load_seed_briefs(settings.seed_dir / "briefs.json")
    }
    yield


app = FastAPI(title="Venture Route engine", version="0.0.1", lifespan=lifespan)
app.include_router(health_router)
app.include_router(internal_router)


@app.exception_handler(EngineError)
async def engine_error_handler(_: object, exc: EngineError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"engine error: {exc}"})
