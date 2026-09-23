"""Composition root. The engine is built once in the lifespan and shared via app.state."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.api.conversation import router as conversation_router
from app.api.health import router as health_router
from app.api.internal import router as internal_router
from app.api.route import router as route_router
from app.config import get_settings
from app.engine.errors import EngineError
from app.engine.metta_engine import MettaRouteEngine
from app.llm.factory import select_adapter
from app.models.brief import load_seed_briefs
from app.models.chat import ValidationErrorResponse
from app.models.validation import errors_message, validation_message
from app.routing.route_service import RouteService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    engine = MettaRouteEngine(settings)
    app.state.engine = engine
    app.state.seed_briefs = {
        brief.id: brief for brief in load_seed_briefs(settings.seed_dir / "briefs.json")
    }
    app.state.route_service = RouteService(engine)
    app.state.known_entities = engine.known_entities()
    app.state.llm_adapter = select_adapter(settings)
    yield


app = FastAPI(title="Venture Route engine", version="0.0.1", lifespan=lifespan)
# D-30: the browser calls the engine across origins. Allow-list from CORS_ORIGINS, GET and
# POST only, credentials off until Sprint 003 adds the Clerk bearer header.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
    allow_credentials=False,
)
app.include_router(health_router)
app.include_router(internal_router)
app.include_router(route_router)
app.include_router(conversation_router)


@app.exception_handler(EngineError)
async def engine_error_handler(_: Request, exc: EngineError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"engine error: {exc}"})


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Malformed or invalid input answers `type: validation-error` with field-specific text."""
    body = ValidationErrorResponse(type="validation-error", message=errors_message(exc.errors()))
    return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))


@app.exception_handler(ValidationError)
async def validation_error_handler(_: Request, exc: ValidationError) -> JSONResponse:
    body = ValidationErrorResponse(type="validation-error", message=validation_message(exc))
    return JSONResponse(status_code=422, content=body.model_dump(by_alias=True))
