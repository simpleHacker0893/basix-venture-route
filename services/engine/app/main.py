"""Composition root. The engine is built once in the lifespan and shared via app.state."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import get_settings
from app.engine.metta_engine import MettaRouteEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.engine = MettaRouteEngine(settings)
    yield


app = FastAPI(title="Venture Route engine", version="0.0.1", lifespan=lifespan)
app.include_router(health_router)
